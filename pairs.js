/*
 *
 * Group text n-Length pairs
 *
 *
 *
 *		PMI(term, tweet) = log [ P(term, tweet) / (P(term)*P(tweet)) 
 * 		log(p(a,b) / ( p(a) * p(b) ))
 *
 *
 *		
 	def pmi(word1, word2, unigram_freq, bigram_freq) {
		prob_word1 = unigram_freq[word1] / float(sum(unigram_freq.values()))
		prob_word2 = unigram_freq[word2] / float(sum(unigram_freq.values()))
		prob_word1_word2 = bigram_freq[" ".join([word1, word2])] / float(sum(bigram_freq.values()))
		return math.log(prob_word1_word2/float(prob_word1*prob_word2),2) 
	}
	
	function pmi(term1, term2) {
		
		var tokenTotal = Object.keys(totalTokens).length;
		var pairTotal = Object.keys(pairCount).length;
		
		var word1_count = tokenCount[term1] / tokenTotal;
		var word2_count = tokenCount[term2] / tokenTotal;
		
		var pair_count = pairCount[term1+','+term2] / pairTotal ;
		
		var result = Math.log2(tokenTotal * (pair_count / (word1_count * word2_count)));	
		var npmi =  result / -(Math.log2(pair_count * tokenTotal));
		
		console.log(result);
		console.log(npmi);
		
	}


	chi-square:
	
	We have a corpus with
	– N = 14 million words.
	– C(new) = 15,828
	– C(companies) = 4675

	Probabity of "new companies" occuring together:
			
		15,828			4675
		-------		* ---------
		14million		14 million
	
	~= 3.6 * 10^(-7)
	
	
	Second example:
		total words: 14,307,668
		C(new)				= 15,828
		C(companies)		= 4675
		C(new companies)	= 8
		
		
							w1=new		w1!=new		
					  |_____________|___________
	w2  = (companies) | 	8       |	4675
	w2 != (companies) |	(15828-8)   |	(14307668 - (4667+15828))
	
	These get labeled O11,O12 and O21,O22
	
	x^2 = 				N(O11*O22 - O12*O21)^2
					------------------------------
				(O11 + O12)(O11 + O21)(O12 + O22)(O21 + O22)


In 2×2 table the cut-off for 95% significance level (p = 0.05) = 3.84 (1.96^2).
If Chi-square is less than 3.84 we can say the result was statistically significant (at the 95% level)

http://www.ox.ac.uk/media/global/wwwoxacuk/localsites/uasconference/presentations/P8_Is_it_statistically_significant.pdf

	
 *
 */

var fs = require('fs');
var natural = require('natural');
var mongoose = require('mongoose')
require('mongoose-long')(mongoose);
var trainer = require('./trainer.js').init(natural);

var unorm = require('unorm');

/* database/mongoose */
var db = {};
var sentenceCollection = false;

var tokenCount = {}; 
var pairCount = {};  
var pairArray = {};
var wordCount = {};

/* file io */
var stream = null;
	
	/* 
	 * have todo garbage collection. can't pin down the bug
	 *
	 */
	 
	function scheduleGc() {
	  if (!global.gc) {
		console.log('Garbage collection is not exposed');
		return;
	  }
	
	  var nextMinutes = 2;
	
	  setTimeout(function(){
		global.gc();
		console.log('Manual gc', process.memoryUsage());
		scheduleGc();
	  }, nextMinutes * 60 * 1000);
	}


	function printSorted(data,limit) {
			
		var sortable = [];
			
		for (var key in data)
			sortable.push([key, data[key]]);
		
		sortable.sort(function(a, b) { return b[1] - a[1]});
		var sliced = sortable.slice(0,(limit) ? limit : Object.keys(data).length);
		
		return sliced;
	}



	/* 
	 * initalize webserver & mongo connection
	 *
	 */
	
	function init() {

		/* patch stem to tokenize */
		natural.PorterStemmer.attach();
 
		/* db */
		//mongoose.Promise = global.Promise;
		var options = {server: {socketOptions: {socketTimeoutMS: 20000}}};
		mongoose.connect('mongodb://localhost/twitter', options);

		/* set mongoose schema */
		
		sentenceCollection = mongoose.model('sentences', mongoose.Schema({
			body: String,
			created: String
		}));
		
		db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function() {
			console.log("connected to mongodb");
			runPairs();
		});	

		stream = fs.createWriteStream("pairs.html");
		stream.once('open', function(fd) {
			console.log("results.html file opened");
		});
		
		process.on('uncaughtException', function (error) {
			console.log(error.stack);
		});

	}


	var replaceHtmlEntites = (function() {
		var translate_re = /&(nbsp|amp|quot|lt|gt);/g,
			translate = {
				'nbsp': String.fromCharCode(160), 
				'amp' : '&', 
				'quot': '"',
				'lt'  : '<', 
				'gt'  : '>'
			},
			translator = function($0, $1) { 
				return translate[$1]; 
			};
	
		return function(s) {
			return s.replace(translate_re, translator);
		};
	})();

	
	
	/* custom replacing. do we wanna go down this route? maybe just redisplay orig tweet? dunno. */
	
	function replaceUnicode(string) {
		
		var charMap = {
			'8226' : '*',	
		};
	
		var result = '';
		
		for(var i = 0; i < string.length; i++) {
			
			var code = string[i].charCodeAt();
			
			if(charMap[code])
				result += charMap[code];
			else
				result += string[i];
					
		}
		
		return result;
		
	}


	function detPrintable(string) {
		
		var body = replaceHtmlEntites(string); /* replace html entities */
		body = replaceUnicode(body);

		body = body.replace(/(.?breaking.?|.?breakingnews.?)/gi,'');		
		body = body.replace(/.?[@#][a-zA-Z0-9_]+/gi,'');	
		body = body.replace(/^rt\s@[a-zA-Z0-9_]+\:/gi,'');	/* remove initial RT: @<screenname> */
		body = body.replace(/(?:\r\n|\r|\n|\t)/g, ' '); /* remove new lines */
		body = body.replace(/(?:https?):\/\/[\n\S]+/g, ''); /* remove URL's - IMPORTANT!! needs to be first. */
		body = body.replace(/(?:via @[a-z]*)+/gi, ''); /* remove via @ tags */
		body = body.replace(/^\s+|\s+$|\s+(?=\s)/g, ''); /* remove leading/trailing spaces/double spaces */
		
		body = body.replace("[\u2018\u2019\u201A\u201B\u2032\u2035]", "'" );
		body = body.replace("[\u201C\u201D\u201E\u201F\u2033\u2036]","\"");
		
		body = body.replace(/[“”‘’\.):-]/g,'');
		body = body.replace(/[,'"]+/g, "").trim(); /* remove repeating dots or commas */
		
		for(var i = 0, sum=0; i < body.length; i++)
		   if(body.charCodeAt(i) >= 0 && body.charCodeAt(i) <= 127)
				sum += 1;
	
		var result = (sum/body.length).toFixed(2);
		
		/* convert remaining */
		//body = body.normalize('NFKD').replace(/[\u0300-\u036F]/g, ''); /* convert to ascii equivs */	
		body = unorm.nfkd(body).normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
		body = body.toLowerCase();
		
		/* final clean */
		body = body.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' '); /* remove non-ascii */
		body = body.replace(/^\s+|\s+$|\s+(?=\s)/g, ''); /* remove leading/trailing spaces/double spaces */

		
		if(result < 0.70)
			return null;
		else
			return body;
		
	}



	function cleanText(txt) {
	
		var body = txt.toLowerCase();
		
		body = replaceHtmlEntites(body); /* replace html entities */
		body = replaceUnicode(body);

		body = body.replace(/(?:https?):\/\/[\n\S]+/g, ''); /* remove URL's - IMPORTANT!! needs to be first. */
		body = body.replace(/^rt\s@[a-zA-Z0-9_]+\:/gi,'');	/* remove initial RT: @<screenname> */
		body = body.replace(/(?:via @[a-z]*)+/gi, ''); /* remove via @ tags */
		body = body.replace(/(?:@[a-z]*)+/g, ''); /* remove screen names */
		body = body.replace(/[, \.]+/g, " ").trim(); /* remove repeating dots or commas */

		body = body.replace("[\u2018\u2019\u201A\u201B\u2032\u2035]", "'" );
		body = body.replace("[\u201C\u201D\u201E\u201F\u2033\u2036]","\"");
		body = body.replace(/[“”‘’]/g,'');	
		//body = body.normalize('NFKD').replace(/[\u0300-\u036F]/g, ''); /* convert to ascii equivs */	
		body = unorm.nfkd(body).normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
		
		body = body.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' '); /* remove non-ascii */
		body = body.replace(/(?:\r\n|\r|\n|\t)/g, ' '); /* remove new lines */
		body = body.replace(/[#\.]+/g, ''); /* other characters we need removed */
		body = body.replace(/^\s+|\s+$|\s+(?=\s)/g, ''); /* remove leading/trailing spaces/double spaces */
		
		return body;
			
	}


	
	/*
	 *	compute n-length collocations
	 *
	 */
	 
	 function computeCollocations(string, length, words, dest) {
	 
	 	var tokens = string.split(' ');
		var pairs = [];
		
		for(var i = 0; i < tokens.length; i++) {
			
			var token = tokens[i].toString();
			words[token] = (words[token]) ? words[token] + 1 : 1;
			
			var buf = '';
			for(var j = 0; (j < length) && (i+j < tokens.length); j++)
				buf += tokens[i+j]+',';
			
			if(j == length)
				pairs.push(buf.substring(0,(buf.length-1)));
			
		}
		
		for(var i = 0; i < pairs.length; i++) {
	
			var pKey = pairs[i];
			dest[pKey] = (dest[pKey]) ? dest[pKey] + 1 : 1;
	
		}
		
		
	}


	function pmi(words, paircount, term1, term2) {
		
		if(paircount < 10)
		return;

		var total_words = Object.keys(words).length;
	
		var prob_word1 = words[term1] / total_words;
		var prob_word2 = words[term2] / total_words;
		
                var result = Math.log2(total_words * (paircount / (words[term1] * words[term2])));
                var npmi =  result / -(Math.log2(paircount * total_words));
		
		if(result > 2)
		console.log("PMI("+term1+","+term2+")="+result+" NPMI="+npmi+" | corpus:"+total_words+" | paircount:"+paircount);
		
		return result;
		
	}
	
	function pmiTest() {
	
		var word1_count = 984;
		var word2_count = 2096;
		var pair_count  = 5;
		var total_words = 24677658;
		
		var prob_word1 = word1_count / total_words;
		var prob_word2 = word2_count / total_words;
		var prob_pairs = '';
		
		var result = Math.log2(total_words * (pair_count / (word1_count * word2_count)));
		console.log(result);
		
		var npmi =  (result / Math.log2(prob_word1 + prob_word2)) - 1;
		result  = Math.round(result * 100) / 100;
		npmi	= Math.round(npmi * 100) / 100;
		console.log("test pmi = "+result);
		console.log("normalized: "+npmi);
		//process.exit();
		
	}
	
	pmiTest();

	function runPairs() {

		var tweets = sentenceCollection.find({}).limit(100000).lean().cursor();
		var total = 0;
		var records = 0;
			
		tweets.on('data', function(doc) {
			
			var data = cleanText(doc.body);					
				
			if(!data)
				return;
				
			var tokens = data.tokenizeAndStem();		
			if(!tokens || !tokens.length)
				return;
					
			var bayes_result = trainer.roots.classify(tokens);
			var bayes_detailed = trainer.roots.getClassifications(tokens);
			var bayes_uniq  = trainer.checkBayes(bayes_detailed);	
				
			if(!bayes_uniq)
				bayes_result = 'common';
							
			var bayes_sub = trainer.traverseTrainer(tokens, bayes_result, false);			
			var bayes_display = (bayes_sub) ? bayes_sub : 'undetermined probablity';
							
			var freqKey = (bayes_sub) ? bayes_sub.result : 'undetermined';
			
			if(freqKey == 'undetermined')
				return;
				
			var val = (freqKey.indexOf("useless") >= 0 || freqKey.indexOf("useful") >= 0) ? 1 : 0;
			
			//if(!val)
			//	return;
			
			//console.log("freqKey="+freqKey+" val="+val);
			
			/* build pairs roots */
			var freqs = freqKey.split('/');
			
			if(bayes_result != 'common' && bayes_result != freqKey) {
					
				if(!pairArray[bayes_result]) {
					pairArray[bayes_result] = {};
					wordCount[bayes_result] = {};				
				}
				
				if(freqKey) {
					if(!pairArray[bayes_result][freqKey]) {
						pairArray[bayes_result][freqKey] = {};
						wordCount[bayes_result][freqKey] = {};
					}
					
				}
				
				var arInsert = (freqKey) ? pairArray[bayes_result][freqKey] : pairArray[bayes_result];
				var wordInsert = (freqKey) ? wordCount[bayes_result][freqKey] : wordCount[bayes_result];
				
			} else {
				
				if(!pairArray[freqs[0]]) {
					pairArray[freqs[0]] = {};
					wordCount[freqs[0]] = {};
				}
				
				if(freqs[1]) {
					
					if(!pairArray[freqs[0]][freqs[1]]) {
						wordCount[freqs[0]][freqs[1]] = {};
						pairArray[freqs[0]][freqs[1]] = {};
					}
					
				}
			
				var arInsert = (freqs[1]) ? pairArray[freqs[0]][freqs[1]] : pairArray[freqs[0]];
				var wordInsert = (freqs[1]) ? wordCount[freqs[0]][freqs[1]] : wordCount[freqs[0]];
	
			}
			
			if(val) {
				
				var clean = detPrintable(doc.body);
				
				if(clean) {
					computeCollocations(clean, 2, wordInsert, arInsert);
					total++;	
				}
					
			}
			
			//if(total%100 == 0)	
			//console.log("total: "+total);
				
				
		});

		tweets.on('close', function() {
	
			console.log("cursor() closed");					
			console.log("[+] total matched: "+total);
	
			var keys = Object.keys(pairArray);

			for(var i = 0; i < keys.length; i++) {
			
				var key = keys[i];
				var subkey = Object.keys(pairArray[key]);

				subkey.forEach(function(item) {
					
					console.log("examining collocations in pair type: "+key+"-"+item);
                                        var words = wordCount[key][item];
                                        var pairs = printSorted(pairArray[key][item]);

					if(key == 'useless') {
						var tokens = item[0].split(',');
                                                var npmi  = pmi(words, item[1], tokens[0], tokens[1]);
						return;
					}				

					pairs.forEach(function(item) {
						var tokens = item[0].split(',');
						var npmi  = pmi(words, item[1], tokens[0], tokens[1]);
						//console.log(npmi);

					});
							
					//console.log(words);
					//console.log(pairs);
				
				});
				
				
			}
			
			//console.log(pairArray[keys[0]]);
			//console.log(pairArray);
			process.exit();
			
		});			

		//console.log(results);
			
		
	}
	
	
	trainer.setTrainer();	
	init();
		
	/*
	var sentence = "welcome to los angeles here and but is the airport structure fire blaze awesome";
	var results = computeCollocations(sentence, 2);
	console.log(results);
	process.exit();
	
	var tokens = sentence.tokenizeAndStem();
	console.log(tokens);
	
	var bayes_result = trainer.roots.classify(tokens);
	var bayes_detailed = trainer.roots.getClassifications(tokens);
	
	console.log(bayes_result);
	console.log(bayes_detailed);
	
		*/		
		

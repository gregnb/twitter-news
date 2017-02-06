/*
 *
 *	Bayes Attempt #2 - Using Bayes Decision Tree
 *
 *  NBTree: https://www.aaai.org/Papers/KDD/1996/KDD96-033.pdf
 */
 

 
//server: java -mx2g -cp stanford/stanford-ner-with-classifier.jar edu.stanford.nlp.ie.NERServer -port 9191 -loadClassifier edu/stanford/nlp/models/ner/english.all.3class.caseless.distsim.crf.ser.gz

// client: java -mx2g -cp stanford/stanford-ner-with-classifier.jar edu.stanford.nlp.ie.NERServer -port 9191 -loadClassifier stanford/classifiers/english.all.3class.distsim.crf.ser.
 
 // db.createCollection("tweets", { capped: true, size: 100000000 })
// DBQuery.shellBatchSize = 300

 /* unique table
 	db.reporters.ensureIndex( { "screen_name": 1 }, { unique: true } );
	db.sentences.ensureIndex( { "body": 1 }, { unique: true } );
	db.tweetcounts.ensureIndex( { "body": 1 }, { unique: true } );
	
 */
 
/* notes


	'Unlicensed driver charged with DUI in crash that killed 6-year-old girl'
	
	figure out why that isn't picking up
	
	
		
	-----
	
	program outline:
		
		train_data(rootWords);
		
		if [tweet in rootWords] {
			
			if[tweet in rootWords.subCategory-useful] {
			
				tweetList[tweetID] = tweet;
				
				if[tweet in tweetGroup] {
					tweetGroup[] = tweet;
				}
					
			}
			
		}
		
	-----
		
	
	
	SEMI-SUPERVISED ---
		Keep track of keywords that keep popping up in your positive results. Add those to the classifier
		
	
	RANKING FORMULA -
		Twitter verified
		Amount of tweets
		Amount of followers
		Tweeting frequency? (possible?)
	
*/

var fs = require('fs');
var natural = require('natural');
var stringSimilarity = require('string-similarity');
var express = require('express');
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser');
var mongoose = require('mongoose')
require('mongoose-long')(mongoose);

var trainer = require('./trainer.js').init(natural);

var languageDetect = require('languagedetect');
var unorm = require('unorm');
var ner = require('ner');
var timeout = require('connect-timeout');

/* objs */
var app = express();
var tokenizer = new natural.WordTokenizer();
var lang = new languageDetect();

var server  = false;

/* database/mongoose */
var db = {};
var tweetSchema = {};
var tweets = false;
var reportersSchema = {};
var reporters = false;
var sentenceCollection = false;
var tweetCountCollection = false;

/* global data */
var freqCount = [];
var tweetCount = {};
var tokenCount = {};

var pairCount = {};

var simTweets = {};
var hashMap = {};


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



	/* 
	 * initalize webserver & mongo connection
	 *
	 */
	
	function init() {

		app.use(timeout('900s'));
		app.use(bodyParser());
		app.use(haltOnTimedout);
		app.use(cookieParser());
		app.use(haltOnTimedout);
		
		// Add your routes here, etc.
		function haltOnTimedout(req, res, next){
		  if (!req.timedout) next();
		}

		/* patch stem to tokenize */
		natural.PorterStemmer.attach();
 
		/* db */
		//mongoose.Promise = global.Promise;
		var options = {server: {socketOptions: {socketTimeoutMS: 20000}}};
		mongoose.connect('mongodb://localhost/twitter', options);
		
		/* listening server */
		var server = app.listen(3000, function () {
			
			var host = server.address().address;
			var port = server.address().port;
			
			console.log('Test app http://%s:%s', host, port);
		
		});


		/* set mongoose schema */
		
		/*var newsSchema = mongoose.Schema({
			
		});*/
		
		var tweetSchema = mongoose.Schema({
			id: Number,
			url: String,
			body: String,
			count_favorites: Number,
			count_tweets: Number,
			is_quoted: Number,
			is_retweet: Number,
			created: String,
			timestamp: String,
			user: {
				id: Number,
				url: String,
				body: String,
			},
			quoted: {
				id: mongoose.Types.Long,
				screen_name: String,
				url: String,
				body: String,
				count_favorites: Number,
				count_tweets: Number,
				followers_count: Number,
				verified: Boolean,
				created: String
			},
			retweeted: {
				id: mongoose.Types.Long,
				screen_name: String,
				url: String,
				body: String,
				count_favorites: Number,
				count_tweets: Number,
				followers_count: Number,
				verified: Boolean,
				created: String
			}
		});
		
		/* tweets collection */
		tweetSchema.set('collection', 'tweets');	
		tweets = mongoose.model('tweets', tweetSchema, 'tweets');


		var reportersSchema = mongoose.Schema({		
			screen_name: String,
			description: String
		});

		reporters = mongoose.model('reporters', reportersSchema);
	
		/* sentence database */
		sentenceCollection = mongoose.model('sentences', mongoose.Schema({
			body: String,
			created: String
		}));


		/* sentence database */
		tweetCountCollection = mongoose.model('tweetcount', mongoose.Schema({
			body: String,
			tokens: String,
			label: String
		}));

		
		db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function() {
	
			console.log("connected to mongodb");
	

				
		});	

		stream = fs.createWriteStream("results.html");
		stream.once('open', function(fd) {
			console.log("results.html file opened");
		});

	}

	/* 
	 *	clean body of tweet text. it can be messy
	 *
	 */

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

	function cleanText(txt) {
	
		var body = txt.toLowerCase();
		
		body = replaceHtmlEntites(body); /* replace html entities */
		body = replaceUnicode(body);

		body = body.replace(/(?:https?):\/\/[\n\S]+/g, ''); /* remove URL's - IMPORTANT!! needs to be first. */
		body = body.replace(/^rt\s@[a-zA-Z0-9_]+\:/gi,'');	/* remove initial RT: @<screenname> */
		body = body.replace(/(?:via @[a-zA-Z0-9_']*)+/gi, ''); /* remove via @ tags */
		body = body.replace(/(?:@[a-zA-Z0-9_]*)+/g, ''); /* remove screen names */
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


	function detPrintable(string) {
		
		var body = replaceHtmlEntites(string); /* replace html entities */
		body = replaceUnicode(body);

		body = body.replace(/(?:\r\n|\r|\n|\t)/g, ' '); /* remove new lines */
		body = body.replace(/(?:https?):\/\/[\n\S]+/g, ''); /* remove URL's - IMPORTANT!! needs to be first. */
		body = body.replace(/^rt\s@[a-zA-Z0-9_]+\:/gi,'');	/* remove initial RT: @<screenname> */
		body = body.replace(/(?:via @[a-z]*)+/gi, ''); /* remove via @ tags */
		
		body = body.replace(/^\s+|\s+$|\s+(?=\s)/g, ''); /* remove leading/trailing spaces/double spaces */

		body = body.replace("[\u2018\u2019\u201A\u201B\u2032\u2035]", "'" );
		body = body.replace("[\u201C\u201D\u201E\u201F\u2033\u2036]","\"");
		body = body.replace(/[“”‘’]/g,'');
		
		for(var i = 0, sum=0; i < body.length; i++)
		   if(body.charCodeAt(i) >= 0 && body.charCodeAt(i) <= 127)
				sum += 1;
	
		var result = (sum/body.length).toFixed(2);
		
		/* convert remaining */
		//body = body.normalize('NFKD').replace(/[\u0300-\u036F]/g, ''); /* convert to ascii equivs */	
		body = unorm.nfkd(body).normalize('NFKD').replace(/[\u0300-\u036F]/g, '');

		if(result < 0.70)
			return null;
		else
			return body;
		
	}
	
	function printSorted(data,limit) {
			
		var sortable = [];
			
		for (var key in data)
			sortable.push([key, data[key]]);
		
		sortable.sort(function(a, b) { return b[1] - a[1]});
		var sliced = sortable.slice(0,(limit) ? limit : 100);
		
		return sliced;
	}

	
	function sortObject(data, field, limit) {
			
		var sortable = [];
			
		for (var key in data)
			sortable.push([key, data[key][field]]);
			
		sortable.sort(function(a, b) { return b[1] - a[1]});
		var sliced = sortable.slice(0,(limit) ? limit : 100);
		var results = { };
		
		for(var i = 0; i < sliced.length; i++)
			results[sliced[i][0]] = data[sliced[i][0]];	
		
		return results;
	
	}
	
	
	
	function dumpTokens(tokens) {
	
		for(var key in tokens) {
		
			var data = tokens[key];
			var result = printSorted(data, 1000);
			
			var filename = 'dump/'+key.replace('/','_')+'.txt';
			var filestream = fs.createWriteStream(filename);
			
			for(var i = 0; i < result.length; i++)
				filestream.write(result[i][0]+','+result[i][1]+'\n');
					
			filestream.end();
				
		}
		
	}
	
	
	function dynamicSort(property) {
		var sortOrder = 1;
		if(property[0] === "-") {
			sortOrder = -1;
			property = property.substr(1);
		}
		return function (a,b) {
			var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
			return result * sortOrder;
		}
	}

	function dumpTweetCount() {

		var sortable = [];
			
		for (var key in tweetCount)
			sortable.push([key, tweetCount[key].group, tweetCount[key].count, tweetCount[key].tokens, tweetCount[key].src]);
		
		sortable.sort(function(a, b) { return (a[1] < b[1]) ? -1 : (a[1] > b[1]) ? 1 : 0});
		
		var filename = 'dump/tweetcount.txt';
		var filestream = fs.createWriteStream(filename);

		var filename = 'dump/tweetcount-clean.txt';
		var filestream_clean = fs.createWriteStream(filename);
					
		for(var i = 0; i < sortable.length; i++) {

			if(sortable[i][1].indexOf('useful') >= 0 && parseInt(sortable[i][2]) > 1) {
				filestream_clean.write('"'+
				sortable[i][0]+'","'+
				sortable[i][1]+'","'+
				sortable[i][2]+'","'+
				sortable[i][3]+'","'+
				sortable[i][4]+"'"+
				'\n');			
			}
			
			filestream.write('"'+
			sortable[i][0]+'","'+
			sortable[i][1]+'","'+
			sortable[i][2]+'","'+
			sortable[i][3]+'","'+
			sortable[i][4]+"'"+
			'\n');
			
		}
					
		filestream.end();
		filestream_clean.end();
				

	}


	function calculateMedian(arr){
	  arr.sort(function(a, b) {
		return a - b;
	  });
	  var i = arr.length/2;
	  i % 1 === 0 ? med = arr[i-1] : med = (arr[Math.floor(i)-1] + arr[Math.floor(i)])/2;
	  return med;
	}


	
	function detLength(arr) {
	
	   var ret = [];
		
		for(var i = 0; i < arr.length; i++) 
			ret.push(arr[i].target.split(' ').length);
		
		for(var i = 0, avg=0; i < ret.length; i++)
			avg += ret[i];
		
		avg = avg / ret.length;
	
		var ans = {
		  avg: avg,
		  mean: calculateMedian(ret)
		};
	
		return ans;
	
	}
	
	function detLang(string) {
	
		var results 	= lang.detect(string, 4);
		var arr = [];
		
		for(var i = 0; i < results.length; i++)
			arr.push(results[i][0]);
	
		var ret = false;
		
		if(arr.indexOf('english') >= 0)
			ret = true;
		
		if(!ret) {
	
			console.log(string);
			console.log(arr);	
			console.log("returning "+ret);

		}
		
		return ret;
			
	}
	
	function summarySort(data, limit) {
			
		var sortable = [];
			
		for (var key in data)
			sortable.push([key, data[key]]);
		
		sortable.sort(function(a, b) { return b[1] - a[1]});
		var sliced = sortable.slice(0,50);
		
		var results = [];
		for(var i = 0, j = 0; i < sliced.length && j < limit; i++) {
			if(sliced[i][1] > 1)
				results[j++] = sliced[i][0];
		}
		
		results.sort();
		return results;
	}


	function sentenceSummary(sentences) {	

		var senCount = {};
		var hashSize = 3;
		
		for(var i = 0; i < sentences.length; i++) {
			
			var tokens = sentences[i].split(' ');
			
			for(var j = 0; j < tokens.length; j++) {
			
				var tKey = tokens[j];
				senCount[tKey] = (senCount[tKey]) ? senCount[tKey] + 1 : 1;
						
			}
			
		}
		
		var results = summarySort(senCount, 3);
		
		if(results.length != hashSize) {
			console.log("[summary to small, skipping] length: "+results.length+" , mapsize = "+sentences.length);
			return;
		}
		
		var hash = results.join('-',results);
		hashMap[hash] = sentences;
				
	}
	
	
	
	function processTweet(result) {
	
		var phraseRet = false;		
		var body = false;
		
		if(((parseInt(result.is_quoted)) && result.quoted.body))
			body = result.quoted.body;

		if(((parseInt(result.is_retweet)) && result.retweeted.body))
			body = result.retweeted.body;
		
		if(!parseInt(result.is_quoted) && !parseInt(result.is_retweet))
			body = result.body;
		
		body = body.replace(/(.?breaking.?|.?breakingnews.?)/gi,'');
		body = trainer.lingoReplace(body);
		
		// ? result.quoted.body : result.body;					
		var orig = detPrintable(body);
		
		if(!orig)
			return false;
		
		body = cleanText(body);
		
		/* stripped. anything useful? if not, exit */
		if(!body.length)
			return false;
			
		/* only english tweets */
		if(!detLang(orig))
			return false;

		/* small tweets not needed */
		var senSplit = body.split(' ');
		
		if(senSplit.length <= 5) {
			console.log("[too small, body size] skipping, sentence: "+body);
			return false;
		}
		
		/* remove numbers & prepositions */
		var tokens = [];
		senSplit.forEach(function(item) {
			if(isNaN(item) && (trainer.prepositons.indexOf(item) < 0))
				tokens.push(item.stem());
		});
				
		//var tokens = body.tokenizeAndStem();
		
		if(tokens.length <= 2) {
			console.log("[too small, token size: "+tokens.length+"] skipping, tokens: "+tokens);
			return false;
		}
				
		trainer.filterPhrases.forEach(function(item) {
			if(body.indexOf(item) > -1)
				phraseRet = true;				
		});
			
		trainer.filterExact.forEach(function(item) {
			if(body == item)
				phraseRet = true;
		});
		
		if(phraseRet) {
			console.log("[phrase match reject] "+body);
			return false;
		}
		
		var text = {
			src: body,
			orig:  orig,
			src_id: result.url.replace("http://twitter.com/null/status/",""),
			url: result.url,
			tokens: tokens,
			quoted_src:	 (parseInt(result.is_quoted) && result.quoted.body) ? true : false,
			retweet_src: (parseInt(result.is_retweet) && result.retweeted.body) ? cleanText(result.retweeted.body) : false,
		};

		if((parseInt(result['count_favorites']) >= 1) || (parseInt(result['count_favorites']) >= 1))
			text.popular = true;
					
		/* set original source id */
		if(parseInt(result.is_quoted)) {
			
			text.relay_id = result.quoted['id'];
			
			if((parseInt(result.quoted['count_favorites']) >= 12) || (parseInt(result.quoted['count_favorites']) >= 1))
				text.popular = true;
						
		} else if(!(parseInt(result.is_quoted)) && parseInt(result.is_retweet)) {

			text.relay_id = result.retweeted['id'];

			if((parseInt(result.retweeted['count_favorites']) >= 1) || (parseInt(result.retweeted['count_favorites']) >= 1))
				text.popular = true;	
				
		}

		if(result.is_retweet && result.retweeted.description && result.retweeted.description.match(/reporter/gi)) {
			
			console.log("adding reporter ("+result.retweeted.screen_name+") to database");
			
			var reporter = new reporters({ 'screen_name' : result.retweeted.screen_name, 'description': result.retweeted.description});
			reporter.save();
			
		}
		
		
		var sentence = new sentenceCollection({ body: orig, created: (new Date().getTime()/1000).toFixed(0)});
		sentence.save();
	
		return text;
		
	}
	
	function displayTweet(result, bayes, probablity) {
		
		var tweet = result.src;
		var tokens = result.tokens;
		var url	= result.url;
		
		var buf = "<b>classification:</b> <font color=red>"+bayes.result+"</font><br />";
			buf += "<b>determination path:</b>"+bayes.path+"</font><br />";
			buf += "<b>url:</b> <a href=\""+url+"\" target=\"_blank\">"+url+"</a><br />";
			buf += "<b>source:</b> '"+tweet+"'<br />";
			buf += "<b>stems:</b> "+tokens+"<br />";
	
		if(result.quoted_src)
			buf += "<b>quoted src:</b> "+result.quoted_src+"<br />";
			
			buf += "<hr />";
			
		return buf;
	
	}

	function htmlTweets(tweets) {
		
		console.log(tweets);
		
		var filename = 'tweets.html';
		var filestream = fs.createWriteStream(filename);
		
var header = '<!doctype html> \
<html> \
<head> \
  <meta charset="utf-8"> \
  <script async custom-element="amp-twitter" src="https://cdn.ampproject.org/v0/amp-twitter-0.1.js"></script> \
  <link rel="canonical" href="<%host%>/components/amp-twitter/"> \
\
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1"> \
  <script async src="https://cdn.ampproject.org/v0.js"></script> \
</head> \
<body>';

		filestream.write(header);
		
		var keys = Object.keys(tweets);
		
		for(var i = 0; i < keys.length; i++) {

			var buf = '<amp-twitter width="390" height="330" \
               data-tweetid="'+keys[i]+'" \
               data-cards="hidden"> \
  </amp-twitter><br />';
			filestream.write(buf);
			
		}
		
filestream.write('</body> \
</html> \
');
					
		filestream.end();
	
	}

	/* 
	 * main webserver logic 
	 *
	 */
	 
	app.get('/', function (req, res) {
		
		//res.write("tweetCount = "+tweetCount.length+"<br />");
		//res.write("simTweets = "+simTweets.length+"<br />");
		
		for(var key in freqCount) 
			res.write("["+key+"] = "+freqCount[key]+"\n");
		
		res.write("\n");
		var total = Object.keys(tweetCount);
		res.write("tweetCount size="+total.length+"\n\n");
		
		console.log("hashMap ------------");
		console.log(hashMap);
		console.log("------------ hashMap ");
		
		console.log("\n");
		console.log("simTweets ----------");
		console.log(simTweets);
		console.log("---------- simTweets");
		
		var sorted = sortObject(simTweets, 'ts', 1000);
		
		var buf = "";
		
		for(var key in sorted) {
			buf += sorted[key].orig;
			buf += '\n';				
		}
		
		res.write(buf);
		htmlTweets(sorted);
		
		dumpTokens(tokenCount);
		dumpTweetCount();
		res.end();
		
	});


	/*
	 *	Stanford NER - Named Entity Recognization 
	 *
	 */
	 
	function tagNER(data) {
	
		ner.get({ port:9191, host:'localhost' }, data.src, function(err, res){
		
			data.tags = {
				'ORGANIZATION': [],
				'PERSON': [], 
				'LOCATION': []
			};
			
			if(!res || !res.raw)
				return
			
			var tokens = res.raw.split(' ');
		
			tokens.forEach(function(token) {
					
				var cols = token.split('/');
				var keys = Object.keys(data.tags);
					
				if(cols[1] && keys.indexOf(cols[1]) >= 0)
					data.tags[cols[1]].push(cols[0]);
				
			});
			
			data.organization = data.tags['ORGANIZATION'];
			data.person = data.tags['PERSON'];
			data.location = data.tags['LOCATION'];
			
			console.log("saving to tags");
			console.log(data);
				
			
		});
	
	}
	

	/* 
	 *	handle live stream data
	 *
	 */

	function liveStream() {
		
		var tweetStream = tweets.find({id: {$gt: 0}, body: {$ne: null}}).lean().tailable().stream();
		
		tweetStream.on('data', function (doc) {
		
			var result = processTweet(doc);		
			if(!result)
				return;
				
			var tokens = result.tokens;		
			if(!tokens || !tokens.length)
				return;
				
			var bayes_result = trainer.roots.classify(tokens);
			var bayes_detailed = trainer.roots.getClassifications(tokens);
			var bayes_uniq  = trainer.checkBayes(bayes_detailed);	
			
			//console.log(bayes_detailed);
			//console.log(bayes_uniq);
		
			if(!bayes_uniq)
				bayes_result = 'common';
			
			var bayes_sub = trainer.traverseTrainer(tokens, bayes_result, false);			
			var bayes_display = (bayes_sub) ? bayes_sub : 'undetermined probablity';
				
			/* token, bayes label, tweet source counters */
				
			var freqKey = (bayes_sub) ? bayes_sub.result : 'undetermined';
			freqCount[freqKey] = (freqCount[freqKey]) ? freqCount[freqKey] + 1 : 1;

			/* need to add something if 
				.popular is there 
				OR
				tweetCount[tKey] >= 2
				
				then try to run similar ?
			*/
			
			var tKey = result.src_id;
							
			if(result.relay_id) {
	
				tKey = result.relay_id;

				if(!tweetCount[tKey])
					tweetCount[tKey] = {};

				tweetCount[tKey].count	= (tweetCount[tKey].count) ? tweetCount[tKey].count + 1 : 1;		
				tweetCount[tKey].src	= result.src;	
				tweetCount[tKey].group	= freqKey;	
				tweetCount[tKey].tokens	= tokens;	
				
				var tweet = new tweetCountCollection({ body : result.orig, label: freqKey, tokens: tokens.join(',')});
				var ret = tweet.save();
	
				if(parseInt(tweetCount[tKey].count) > 1 && freqKey.indexOf('useful') >= 0 && freqKey != 'undetermined') {
	
					if(!simTweets[tKey]) {

						var tokenSentence = tokens.join(' ');
						var tokenLength = tokens.length;
						
						/* first see if it belongs to a similar group already established. */
						var groupFound = false;
						
						for(var key in hashMap) {
							
							var groupResults = stringSimilarity.findBestMatch(tokenSentence, hashMap[key]);
							var score = -1;
							var mapLength = 0;

							var bestMatch = groupResults.bestMatch;

							if(bestMatch.rating == 1) {
								console.log("[best match, skipping] sentence: "+tokenSentence);
								console.log(bestMatch);
								groupFound = true;
								break;
							}
															
							if(groupResults.ratings) {
								
								var groupRatings = groupResults.ratings;
								var groupSum = [];
														
								for(var i = 0; i < groupRatings.length; i++)
									groupSum.push(groupRatings[i].rating);
								
								
								score = calculateMedian(groupSum);
								mapLength = detLength(groupRatings);
								
							}
							
							//console.log("[key score: "+key+"] score: "+score+" sentence: "+tokenSentence);
							
							if(score >= 0.32) {
						
								console.log("found group!, breaking");
								console.log("[group check - key: "+key+"] - score: "+score);	
								console.log("ratings");
								console.log(groupResults.ratings);
								console.log(hashMap[key]);

								if((tokenLength/mapLength.mean) < 0.55) {
								
									console.log("[group fail - key: "+key+"] too small. length:"+tokenLength+" mean:"+mapLength.mean+" sentence: "+tokenSentence);
								
								} else {
	
									groupFound = true;
									console.log("[group add - key: "+key+"] adding sentence: "+tokenSentence);
									hashMap[key].push(tokenSentence);								
								
								}
								
								break;
								
							} else {
	
								if(score >= 0.23 && score < 0.32)
									console.log("[key score: "+key+"] score: "+score+" sentence: "+tokenSentence);
	
							/*	console.log("no match! sentence: "+tokenSentence)
								console.log("[group check] ("+hashMap[key]+") - sum: "+groupSum+" - score: "+score);		
								console.log(groupResults.ratings);
							*/
							}
							
							console.log("\n");
								
						}
						

						/* no group found, let's try to create one. maybe. */

						if(!groupFound) {
											
							var matchArray = [];
							for(var key in simTweets)
								matchArray.push(simTweets[key].tokens);
		
							var similar = (matchArray.length) ? stringSimilarity.findBestMatch(tokenSentence, matchArray) : false;
	
							console.log("[follow ("+freqKey+")] "+result.src);

							if(similar && similar.ratings) {
									
								var ratings = similar.ratings;
								console.log("find similar: "+tokenSentence);
								console.log("----");
								var sentenceMap = [tokenSentence];
								/*console.log("sentence map");
								console.log(sentenceMap);
								console.log("\n");
								*/
								for(var i = 0; i < ratings.length; i++) {
									
									if(ratings[i].rating >= 0.45) {
										sentenceMap.push(ratings[i].target)
										console.log(ratings[i]);
									}
									
								}
								
								/*
								console.log("\n");
								console.log("map now");
								console.log(sentenceMap);
								*/
								if(sentenceMap.length > 1)						
									sentenceSummary(sentenceMap);
		
								console.log("----");
														
							}
						
						}
						
						console.log("\n\n");

	
					}

						
					simTweets[tKey] = { 
						src: result.src,
						orig: result.orig,
						tokens: tokens.join(' '),
						ts: (new Date().getTime()/1000).toFixed(0)
					};

					tagNER(simTweets[tKey]);
				
					
				}
				
				
			} else {

				if(result.popular) {
	
					console.log("popular tweet! src=["+result.src+"]");
								
					if(!tweetCount[tKey])
						tweetCount[tKey] = {};
	
					tweetCount[tKey].count	= (tweetCount[tKey].count) ? tweetCount[tKey].count + 1 : 1;		
					tweetCount[tKey].src	= result.src;	
					tweetCount[tKey].group	= freqKey;	
					tweetCount[tKey].tokens	= tokens;	

				}
				
			}
	

				
			for(var k = 0; k < tokens.length; k++) {
					
				if(!tokenCount[freqKey])
					tokenCount[freqKey] = {};
					
				var tKey = tokens[k];
				tokenCount[freqKey][tKey] = (tokenCount[freqKey][tKey]) ? tokenCount[freqKey][tKey] + 1 : 1;
				
			}				
					
			var buf = displayTweet(result, bayes_display); 
			stream.write(buf);
		
			//console.log("read in document");
			//console.log(tweetCount);
			//console.log(doc.body);
			
		}).on('error', function (err) {
		
			// handle the error
			console.log("error");
			console.log(err);
		
		}).on('close', function () {
		
			// the stream is closed
			console.log("closed");
		
		});
	
	}
	
	trainer.setTrainer();					
	
	init();
	scheduleGc();
	liveStream();


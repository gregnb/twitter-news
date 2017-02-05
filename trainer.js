/*
 *	Training module
 *
 */


var _this = module.exports = {

	init: function(obj) {
		
		_this.filterPhrases = null;
		_this.filterExact = null;

		_this.roots = new obj.BayesClassifier();			
		_this.natural = obj;
		_this.trainer = {};
		
		_this.setPrepositions();
		return module.exports;
		
	},

	setPrepositions: function() {
	
		_this.prepositons = ['a','abaft','aboard','about','above','absent','across','afore','after','against','along','alongside','amid','amidst','among','amongst',
			'an','anenst','apropos','apud','around','as','aside','astride','at','athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between',
			'beyond', 'but', 'by', 'circa', 'concerning', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'for', 'forenenst', 'from', 'given', 'in', 
			'including', 'inside', 'into', 'lest', 'like', 'mid', 'midst', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'of', 'off', 'on', 'onto', 'opposite',
			'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'regarding', 'round', 'sans', 'save', 'since', 'than', 'through', 'throughout', 'till',
			'times', 'to', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'via', 'vice', 'with', 'within', 'without', 'worth'
		];

	},
	
	
	lingoReplace: function(data) {

		var ret = data;
		
		var words = {
			'y/o' : 'year old',
			'w/o' : 'with out',
			'sh*t' : 'shit',
			'f*ck' : 'fuck',
			'f**k' : 'fuck',
			'c*nt' : 'cunt',
			'b*tch' : 'bitch',
			'w/' : 'with',
			'h/t' : 'hat tip',
			'b/f' : 'before',
			'b4' : 'before',
			'2x' : 'twice',
			'%'  : ' percent',
		};
		
        for(var key in words)
            ret = ret.replace(key,words[key]);
		
		return ret;
					
	},
	
	/*
	 *	Traverse the trainer structure
	 *
	 */
	
	traverseTrainer: function(text,key,debug) {
	
		var result = [];
		var data = trainer[key];
		
		if(key != 'common')
			result.push(key);
			
		_this.traverseSearch(text,data,false,result);	
		return (result.length) ? { result: result[result.length - 1], path: result.join('>') } : null;
		
	},
	
	traverseSearch: function(text,data,debug,results) {
	    
		for (i in data) {
			
			if (!!data[i] && typeof(data[i]) == 'object') {
				
				var keys = Object.keys(data[i]);
				var position = data[i];
				
				if(i == 'level') {	
					
					var classifier = new _this.natural.BayesClassifier();
						
					for(key in data[i])
						if(data[i][key]['tokens'])
							classifier.addDocument(data[i][key]['tokens'], key);			
					
					classifier.train();
					
					var bayes_result = classifier.classify(text);
					var bayes_detailed = classifier.getClassifications(text);
					var bayes_uniq  = _this.checkBayes(bayes_detailed);
					
					if(debug) {
						console.log("text = "+text);
						console.log(bayes_uniq);
						console.log(bayes_detailed);
					}
					
					if(bayes_uniq && data[i][bayes_result]) {
						position = data[i][bayes_result];		
						answer = bayes_result;
						results.push(bayes_result);
					}
					
					if(debug)
						console.log(bayes_result);
					
				}
	
				_this.traverseSearch(text,position,debug,results);
				
			}
		}
	
	},
	
	checkBayes: function(data) {
	
		var sameval = data[0].value;
		var bool_uniq = false;
			
		for(var i = 0; i < data.length; i++) {
			if(data[i].value != sameval) {
				bool_uniq = true;
				break;
			}
		}
	
		
		return bool_uniq;
	
	},


	
	/*
	 *	Build Trainer for Bayes Algorithm
	 *
	 */
	
	setTrainer: function() {
	
		
		/* not quite the trainer, but we have some stupid phrases we should filter */
		filterPhrases = [
			'only have one match',
			'pew pew',
			'who cares',
			'funny how',
			'good way',
			'making jokes',
			'blow a kiss',
			'down the drain',
			'big business',
			'telling you',
			'opposites attract',
			'i decided',
			'super very',
			'very funny',
			'oh yea',
			'my house',
			'my car',
			'if i ',
			'just remembered',
			'remember that',
			'remember when',
			'i will be dead',
			'i added',
			'worst nightmare',
			'cry your heart out',
			'technology wave',
			'words of wisdom',
			'our house',
			'life advice',
			'ruins my day',
			'flu shot',
			'my selfie',
			'get pissed',
			'off topic',
			'ruined my day',
			'i mean',
			'i liked',
			'i swear',
			'all fun',
			'would you',
			'never succeed',
			'second thought',
			'reminds me',
			'a reminder',
			'screen shot',
			'sneek peak',
			'no brainer',
			'my gun',
			'well done',
			'why do',
			'acme corp',
			'just kidding',
			'my wife',
			'so sick',
			'you be',
			'acme corporation',
			'skills learned',
			'blind leading',
			'your house',
			'time travel',
			'dont worry',
			'save your relationship',
			'want a shot',
			'i realise that',
			'question of the day',
			'my heart bleeds',
			'my heart aches',
			'punch yourself',
			'like shit',
			'another season',
			'shit out of',
			'naked gun',
			'so this',
			'only if',
			'shaking my head',
			'how dumb',
			'your friends',
			'my device',
			'gonna be',
			'drinking game',
			'big sales',
			' aliens',
			'white ppl',
			'long shot',
			'google maps',
			'only funny',
			'actually',
			'you dont',
			'lost my',
			'if we were',
			'get busy',
			'i would',
			'fresh air',
			'always say',
			'dress up',
			'being drunk',
			'yeah right',
			'gave me',
			'that guy',
			'as usual',
			'im hungry',
			'talking about',
			'the phrase',
			'what if',
			'love this',
			'we celebrate',
			'open house',
			'dead ass',
			'scary stuff',
			'i hate',
			'time is',
			'best time',
			'i wish',
			'wish i',
			'technically possible',
			'looking for true love',
			'looking for love',
			'pots and pans',
			'get caught',
			'imagine being',
			'imagine if',
			'mad weak',
			'pretty sure',
			'no experience required',
			'egg troll',
			'help smokers',
			'von dutch',
			'best rapper alive',
			'fun fact',
			'shoe to drop',
			'bottom line',
			'big ass',
			'its going down',
			'i cant even',
			'take a shot',
			'taking a shot',
			'took a shot',
			'someone give',
			'needs a shot of',
			'need a shot',
			'someone tell',
			'insert key',
			'shoot this',
			'notice how',
			'depo shot',
			'im guessing',
			'never been',
			'instead of',
			'dead hookers',
			'this day on',
			'on this day',
			'our workout',
			'the 50s',
			'the 60s',
			'the 70s',
			'the 80s',
			'the 90s',
			'in fact',
			'like a dog',
			'big job',
			'easy job',
			'not again',
			'i have',
			'shot of',
			'what time',
			'i remember',
			'i lived',
			'of course',
			' in person',
			'if you could',
			'i wonder',
			'i hope',
			'i had a dream',
			'truth or dare',
			'gotta say',
			'that moment',
			'i must say',
			'hows your',
			'get why',
			'how do',
			'oh look',
			'visit our',
			'about time',
			'cant wait',
			'amazes me',
			'broken dreams',
			'if you think',
			'an embarrassment',
			'i am tired',
			'i feel like',
			'open shots',
			'shoot my shot',
			'im tired',
			'when i see',
			'our government',
			'fun and games',
			'another example',
			'you know who',
			'its lit',
			'tell me',
			'evidently',
			'your opinion',
			'#prayfor' /* debatable */
		];
		
		filterExact = [
			'shots fired'
		];

		_this.filterPhrases = filterPhrases;
		_this.filterExact	= filterExact;
		
		/* keep uptop since reuse it a couple of times and can't access an object from inside object that isn't declared */
		var uselessWords = [
			'bro','stupid','sex','silly', 'interview', 'beach', 'kiss', 'blow','shade', 'interview', 'smfh',
			'advic', 'amen', 'summer', 'snake','whiskei', 'cup', 'tea', 'vagina', 'youtub', 'gta', 'like', 
			'chicken', 'nugget', 'loin','god', 'shit', 'fuck', 'fuckin', 'nigga', 'ass', 'lmfao', 'lmao', 'moist', 
			'bro', 'twitter', 'seo', 'digitalmarketing', 'boob', 'dpi', 'pigment', 'listerin', 'ugli', 'obfusc', 'scumbag',
			'xbox', 'ps4', 'urbanworld', 'teamassassin', 'conspiraci', 'theori', 'barbi', 'anthem', 'nation', 'fucker',
			'wtf', 'loser', 'bitch', 'prohibitionist', 'gunfail', 'sphere', 'handjob', 'graviti', 'sneez', 'yoko',
			'noob', 'autonuk', 'autoadmin', 'accent', 'vowel', 'kneel', 'puppet', 'tetanu', 'butterfli',
			'rhetor', 'ignor', 'bigdata', 'analyt', 'iight', 'haramb', 'cheesesteak', 'pussi', 'inept', 'crap',
			'neverhillari', 'cumshot', 'bullshit', 'gunflak', 'cosplai', 'ghost', 'hadoop', 'linux', 'dragon',
			'vegeta', 'gameplai', 'xenovers', 'cock', 'ladyboi', 'shemal', 'brew','porno','smutland','dick','pixi',
			'poptart', 'semester', 'croni', 'mmm', 'anim', 'cum', 'orgasm', 'plz', 'hmu', 'lame', 'bruh', 'cliffnot',
			'gtg', 'oomf', 'beer', 'vodka', 'jalapeno', 'habanero', 'lifehack', 'assimilated', 'bish', 'childish',
			'gsm', 'sm', 'burbs', 'brazy', 'technologist', 'lifecar', 'electrohouse', 'basehouse', 'edm', 'gtaonline',
			'nowplaying', 'everytim', 'playlist', 'globalist', 'webrtc', 'iot', 'lool', 'retweet', 'yall', 'bullshter',
			'icann', 'roswell', 'redeye', 'goddamn', 'chungha', 'tweetin', 'fangirl', 'playa', 'unity3d', 'xdxd',
			'youdontsai', 'populist', 'pinterest', 'twerkin', 'twerk', 'troll', 'nudist', 'gamedev', 'hyperpack',
			'shotputt', 'pixelart', 'pennystock', 'stocktrad', 'bimbo', 'sperm', 'fckn', 'dartboard', 'marksman',
			'lmk', 'raunchi', 'fyi', 'dude', 'booboo', 'b12', 'twitterland', 'shitti', 'ballsi', 'woodsman', 'um',
			'corporatist', 'pinata', 'finna', 'douch', 'fax', 'letter', 'earthworm', 'syphilit', 'subtweet',
			'mularkei', 'smh', 'mama', 'ratchet', 'clatchet', 'noun', 'verb', 'fbomb', 'mediocr', 'unfollow', 'tbh',
			'statist', 'welp', 'timestamp', 'booz', 'stormtroop', 'crookedhillari', 'crookedobama', 'trump2016',
			'fuckboi', 'dawg', 'homeboi', 'diy', 'lol', 'illuminati',  'creatur', 'meme'
		];
		
		/*
		 * Bayesian Decision Tree (Visualize probablity Chain rule)
		 *
		 */
		 
		trainer = {
			
			'entertainment': {
				tokens: ['famou', 'film', 'star', 'cast', 'singer', 'hollywood', 'bollywood', 'actress', 'actor', 'stage', 'screen', 'rapper', 'divorc', 'comedian'],
				level: {
					'entertainment-useful': {
						tokens: [
							'hospit', 'drug', 'dead', 'death', 'arrest', 'suspect', 'kill', 'divorc', 'critic', 'condit',
							'retir', 'injur', 'alleg', 'hbd', 'birthday', 'realiti', 'physic', 'gunpoint', 'robber', 'robbery',
							'tragic', 'di', 'injuri', 'charg', 'traffick', 'ganja', 'perform', 'fire', 
						]
					},
					'entertainment-useless': {
						tokens: uselessWords.concat([
							'funny', 'lame', 'whatever', 'bodi', 'doubl', 'fill', 'mysteri', 'kindl',
							'nobodi', 'care', 'until', 'ios10', 'imessag', 'karaok', 'honest',
							'boom', 'rather', 'back', 'send'
						])
					},					
				}
			},
				
			'sports': {
				tokens: [
					'athlet', 'nba', 'nfl', 'mlb', 'nascar', 'basketbal', 'footbal', 'soccer', 'basebal', 'fantasy', 'pitcher', 'catcher', 'superstar', 'golfer',
					'exnba', 'exnfl', 'exmlb', 'exnascar'
				],
				level: {
					'sports-useful' : {
						tokens: [
							'hospit', 'drug', 'dead', 'death', 'arrest', 'suspect', 'kill', 
							'retir', 'injur', 'trade', 'player', 'accid', 'injuri'
						],
					},
					'sports-useless' : {
						tokens: uselessWords.concat([
							'tweet', 'hell', 'dude', 'deadass', 'shit', 'fuck', 'win', 'advertis', 
							'disgust', 'pace', 'work', 'joke', 'unwatch', 'lol', 'glorifi', 'screw',
							'bitch', 'dirt', 'weekends', 'mf', 'comments', 'ads', 'kneel',
							'worst', 'fantasi', 'yup', 'nerv', 'idk', 'grade', 'aint', 'focus', 'fli',
							'theme','frat', 'better', 'cold', 'hot', 'warm', 'weather', 'guess',
							'sit', 'watch', 'greatest', 'tightmuscl', 'count'
						])
					},
				},
			},
		
			'hurrican-torando' : {
				tokens: ['hurrican', 'wind', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'storm', 'tornado'],
				level: {
					'hurrican-useful' : {
						tokens: [
							'magnitud', 'hit', 'felt', 'sprint', 'advisori', 'noaa', 'pressur', 'landfal', 'forecast',
							'strength', 'upgrad', 'possibl', 'landfal', 'risk', 'cat', 'watch', 'issu',
							'major', 'caribbean', 'wind', 'mph', 'pressur', 'categori',
							'intensifi', 'forecast', 'rapidli', 'bahama', 'caribbean', 'major'
						]
					},
					'hurrican-useless': {
						tokens: uselessWords.concat([
							'hella', 'excited', 'ugli', 'retweeted', 'twitter', 'notif', 'text',
							'less', 'fund', 'stole', 
						])
					}
				}
			},
			
			'earthquak': {
				tokens: ['earthquak', 'shake', 'quak', 'magnitud'],
				level: {
					'earthquake-useful' : {
						tokens: [
							'earthquak', 'shake', 'quak', 'magnitud', 'hit', 'felt', 'sprint',
						]
					},
					'earthquake-useless': {
						tokens: uselessWords.concat([
							'hella', 'excited', 'ugli', 'retweeted', 'twitter', 'notif', 'text',
							'less', 'rooster', 'squawk', 'toothpast', 'favorit', 'journal'
						])
					}
				}
			},
			
			'common': {
				
				level: {
					'violence/police': {
						tokens: [
							'shot', 'shooter', 'school', 'activ', 'polic', 'cop', 'dead', 'student', 'loos', 'student', 'lockdown', 'kill', 'though', 'suspect', 'confirm',, 
							'confirm', 'search', 'local', 'bullet', 'report', 'gunfir', 'offic', 'possibl', 'sheriff', 'person', 'incid', 'stab', 'dy', 'back', 'arrest',
							'detect', 'suspect', 'kill', 'injur', 'drug', 'school', 'lockdown', 'shield', 'policeman', 'constabl', 'vandal', 'rape', 'sergeant',
							'rampag', 'weapon', 'gunman', 'gunshot', 'break', 'fbi', 'terrorist', 'terror', 'train', 'crash', 'derail', 'burglar', 'explicit',
							'steal', 'trial', 'charg', 'officerinvolv', 'gunpoint', 'robber', 'attack', 'martyrdom', 'dui', 'murder'
						],
						level: {
							'violence/police-useful' : {
								tokens: [
									'shot', 'shooter', 'school', 'activ', 'polic', 'cop', 'dead', 'student', 'loos', 'student', 'lockdown', 'kill', 'though', 'suspect', 'confirm', 
									'down', 'nazi', 'weapon', 'gunman', 'siren', 'infiltr', 'gunshot', 'down', 'local',
									'confirm', 'search', 'larg', 'local', 'bullet', 'report', 'gunfir', 'offic', 'possibl', 'sheriff', 'person', 'incid', 'stab', 'dy', 'back', 'arrest',
									'detect', 'suspect', 'kill', 'injur', 'drug', 'school', 'lockdown', 'shield', 'surveil', 'situat', 'trigger',
									'scream', 'policeman', 'constabl', 'sought', 'caught', 'burglari', 'unrespons', 'rape', 'vandal', 'sergeant',
									'arson', 'grab', 'hear', 'heard', 'hosp', 'patrol', 'mayor', 'train', 'crash', 'deadli', 'accid', 'investig',
									'transit', 'safeti', 'derail', 'hospit', 'victim', 'brazen', 'threaten', 'steal', 'trial', 'charg', 'crowd', 'flee',
									'stole', 'held', 'reportedli', 'spokesperson', 'uninjur', 'shaken', 'develop', 'domest', 'violenc', 'traffick',
									'human', 'unsaf', 'die'
														
								]
							},
							'violence/police-useless' : {
								tokens: uselessWords.concat([
									'vaccin', 'idk', 'polio', 'against', 'loyal', 'fans', 'grade', 'insult', 'trump',
									'understand', 'bigger', 'gossip', 'onc', 'matter', 'act', 'deplor', 'vote', 'hrc',
									'homi', 'tag', 'itd', 'diff', 'titl', 'wwe', 'thousand', 'vote', 'pitch', 
									'devil', 'free', 'admiss', 'toxic', 'silent', 'quiet', 'sexi', 'rang', 'fly',
									'coffe', 'concept', 'sink', 'finish', 'drink', 'game', 'cowboi', 'compton',
									'earn', 'joke', 'comedi', 'propos', 'squirt', 'photoshoot', 'session',
									'profession', 'clinic', 'lie', 'honest', 'tortilla', 'chip', 'trust',
									'hgtv', 'sublimin', 'yo', 'luther', 'rap', 'antenna', 'yank', 'apolog',
									'grill', 'odd', 'unless', 'pussi', 'pro', 'iv', 'deserv', 'donat','chariti','respect',
									'whine', 'shower', 'mention', 'linebacker', 'scammer', 'dwt', 'count', 'hope',
									'denial', 'sandal', 'leash', 'hump', 'healer', 'bleach', 'tweet', 'delet', 'someth',
									'season', 'sling', 'rememb', 'pen', 'savageri', 'redskin', 'insecur', 'particular',
									'pun', 'rate', 'guess', 'privileg', 'beaver', 'rainbow', 'divers', 'compass', 'zombie',
									'tip', 'booz', 'flatter', 'genuin', 'coward', 'flinch', 'screw', 'hell', 'hella',
									'pike', 'stick', 'slaveri', 'hoop', 'lifelesson', 'liber', 'gop', 'conserv', 'dm',
									'titl', 'redesign', 'rebuild', 'ceremoni', 'silver', 'lower', 'degrassi', 'challeng',
									'wine', 'conclus', 'laugh', 'chill', 'satan', 'uteru', 'zombi', 'tupac', 	'bunch',
									'clown', 'siriu', 'yo', 'myself', 'appl', 'scar', 'stuff', 'tempor','lobe',
									'whoever', 'pretend', 'tendenc', 'neva', 'countin', 'nhk', 'pour', '49er',
									'corrupt', 'program', 'qualiti', 'dumbest', 'grow', 'fat', 'ticket', 'snap',
									'somethi', 'omfg', 'picki', 'sportscent', 'espn', 'nightmar', 'nap', 'dream',
									'singer', 'im', 'oh', 'wait', 'cheap', 'model', 'wanna', 'coon', 'debat',
									'cheer', 'unscientif', 'favor', 'meaningless', 'idc', 'youll', 'everytim',
									'incas','yall','care', 'mmm', 'blm', 'q1', 'q2', 'q3', 'q4', 'gdp',
									'liter', 'pai', 'boot', 'read','whole','thread','damn','so','hard',
									'anymor', 'oh', 'hei', 'bet', 'aint', 'excus', 'iv', 'everi', 'incas', 'yall', 'fri',
									'fuckin', 'rainbow', 'glitter', 'joi', 'pitch', 'coachella', 'data', 'capit', 'market',
									'ecosystem', 'fintech', 'quack', 'bandaid', 'waddl', 'mar', 'wanna', 'halfdrunk',
									'date', 'wholl', 'why', 'confetti', 'favorit', 'haha', 'hahaha', 'cc'	,
									'seat', 'alwai', 'readi', 'wit', 'snitch', 'titl', 'revolut', 'slot', 'aristocrat', 'bonus',
									'sprite', 'megapack', 'inspir', 'sleepwalk', 'tho', 'comedian', 'pumpkin', 'clap',
									'happi', 'yum', 'innov', 'song', 'salad', 'menu', 'massag', 'appli', 'smh', 'dem',
									'infrastructur', 'ridicul', 'tril', 'dick', 'effort', 'promo', 'awesom', 'quirk', 'microsoft', 'growth',
									'rhino', 'honestli', 'mix', 'energet', 'guidanc', 'rain', 'vocabulari', 'manner', 
									'funni', 'trophi', 'cadenc', 'rust', 'egregi'
								])
							},
						}
					},
					

					'fire/explosion': {
						tokens: [
							'fire', 'rise', 'distanc', 'smoke', 'damage', 'marhsal', 'investig', 'lockdown', 
							'school', 'kill', 'detect', 'explos', 'boom', 'bomb', 'injur', 'deadli', 'dead', 'hostil', 'kill', 'kerosen', 'break',
							'firefight', 'escap', 'report', 'devic', 'suspici'
						],
						
						level: { 
							'fire/explosion-useful' : {
								tokens: [
								'fire', 'rise', 'distanc', 'larg', 'smoke', 'damage', 'marhsal', 'investig', 'lockdown', 'school', 'break', 'kill', 'detect', 'least',
								'explos','boom','heard', 'hear', 'saw', 'loud', 'noise', 'bomb', 'injur', 'deadli', 'dead', 'hostil', 'kill', 'kerosen', 'break', 'live',
								'firefight', 'escap', 'report', 'devic', 'suspici', 'mayor', 'train', 'found', 'felt', 'pressur', 'train', 'deton', 'robot', 'blast',
								'hurt', 'vigil', 'accid', 'faulti', 'structur', 'blaze', 'heard', 'hear', 'saw', 'loud', 'noise', 'larg', 'balloon'
								]
							},
							'fire/explosion-useless' : {
								tokens: uselessWords.concat([
									'rubber', 'free', 'admiss', 'soap', 'dish', 'handcraft', 'instinct', 'ufo', 'crap',
									'music', 'makeup', 'good', 'leisur', 'eat', 'free', 'busti', 'proud', 'offer',
									'lust', 'love', 'fish', 'tank', 'music', 'episod', 'press', 'button', 'weather',
									'misogyny', 'elect', 'polit', 'idea', 'cum', 'player', 'poetri' , 'book', 
									'vampire', 'king', 'event', 'seri', 'smear', 'mic', 'yall', 'care',
									'campaign', 'mmm', 'blm', 'mmm', 'blm', 'q1', 'q2', 'q3', 'q4', 'gdp',
									'liter', 'pai', 'boot', 'read','whole','thread', 'damn','so','hard',
									'regist','vote','taxcheat', 'rose','red','violet','import','replac','popul','plan',
									'feet','work','speed', 'wise', 'vs', 'bless', 'biggest', 'firepreventionweek',
									'oh', 'hei', 'gag', 'bet', 'aint', 'great', 'thank', 'tht', 'laugh',
									'rainbow', 'glitter', 'joi', 'pitch', 'coachella', 'plai', 'data', 'capit', 'market',
									'ecosystem', 'fintech', 'pack', 'phyno', 'mar', 'wanna', 'movi', 'understand',
									'stuff', 'mad', 'game', 'win', 'confetti', 'surpris', 'favorit', 'haha', 'hahaha', 'cc',
									'disconnect', 'digit', 'ke', 'low', 'access', 'visual', 'im', 'monster', 
									'absolut', 'goal', 'titl', 'revolut', 'bon', 'slot', 'aristocrat', 'bonus',
									'sprite', 'megapack', 'inspir', 'mental', 'tho', 'bra', 'comedian', 'benefit',
									'chocol', 'almond', 'macaron', 'stamina', 'clap', 'invert', 'abund', 'industri',
									'nimbl', 'spurt', 'happi', 'yum', 'innov', 'dog', 'cat', 'entrepreneurship', 'creepi',
									'limbaugh', 'show', 'song', 'salad', 'menu', 'nah', 'perform', 'singular', 'playoff',
									'teach', 'makeup', 'massag', 'appli', 'smh', 'dem', 'fan', 'dishonour', 'foward', 'congratul',
									'pastor', 'winner', 'enjoi', 'beauti', 'fave', 'illustr', 'laugh', 'lol', 'probabl',
									'technolog', 'solar', 'review', 'sweati', 'quirk', 'candi', 'cotton', 'cone', 'franchis', 'rectum',
									'dress', 'legit', 'juic', 'midget', 'fundrais', 'donat', 'tweet', 'speaker', 'immun', 'gratifi',
									'hungri', 'loyal', 'gospel', 'aspir', 'founder', 'nda', 'recruit', 'excit', 'reform',
									'ventur', 'capitalist', 'cadenc', 'rust', 'sprite'
																								 
								])
							}
						}
						
					},
				
					'useless': {
						tokens: uselessWords
					}
					
				}
				
			},
			
			'useless': {
				tokens: uselessWords
			}
		
		};	
	
	
		/* build root decisions */
		for(var key in trainer)
			if(trainer[key].tokens)
				_this.roots.addDocument(trainer[key].tokens, key);	
	
		_this.roots.train();
		
	}


};

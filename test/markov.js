var test = require('tape');

var Markov = require('../markov');
var createTestObjects = require('./object');

var markovTest = createTestObjects.wrapper({
    type: Markov,
    expected: function() {
        var start = new Array(this.args && this.args[0] && this.args[0].stateSize || 1);
        for (var i=0, n=start.length; i<n; i++) start[i] = null;
        start = String(start);
        var exp = {
            counts: {},
            transitions: {}
        };
        exp.transitions[start] = [];
        return exp;
    }
}, ['markov']);

markovTest('Markov addTokens', function(assert) {
    assert.markov.okSteps([
        {
            op: ['addTokens', []]
        },
        {
            op: ['addTokens', 'this is a testing sentence'.split(' ')],
            expect: {
                counts: {
                    this: 1,
                    is: 1,
                    a: 1,
                    testing: 1,
                    sentence: 1,
                },
                transitions: {
                    '': ['this'],
                    this: ['is'],
                    is: ['a'],
                    a: ['testing'],
                    testing: ['sentence'],
                    sentence: [null],
                }
            }
        },
        {
            op: ['addTokens', 'here is another testing sentence'.split(' ')],
            expect: {
                counts: {
                    here: 1,
                    is: 2,
                    another: 1,
                    testing: 2,
                    sentence: 2,
                },
                transitions: {
                    '': ['here', 'this'],
                    here: ['is'],
                    is: ['a', 'another'],
                    another: ['testing'],
                    testing: ['sentence'],
                }
            }
        }
    ]);
    assert.end();
});

markovTest('Markov special keywords', function(assert) {
    assert.markov.okStep({
        op: ['addTokens', 'the token constructor is special'.split(' ')],
        expect: {
            counts: {
                the: 1,
                token: 1,
                constructor: 1,
                is: 1,
                special: 1
            },
            transitions: {
                '': ['the'],
                the: ['token'],
                token: ['constructor'],
                constructor: ['is'],
                is: ['special'],
                special: [null]
            }
        },
    });
    assert.end();
});

markovTest('Markov save/load', function(assert) {
    assert.markov.okStep({
        op: function setup(markov) {
            markov.addTokens('a b c'.split(' '));
            markov.addTokens('a b d'.split(' '));
            markov.addTokens('c e g'.split(' '));
        },
        expect: {
            counts: {
                a: 2,
                b: 2,
                c: 2,
                d: 1,
                e: 1,
                g: 1,
            },
            transitions: {
                '': ['a', 'c'],
                a: ['b'],
                b: ['c', 'd'],
                c: ['e', null],
                d: [null],
                e: ['g'],
                g: [null],
            }
        }
    });
    var data = assert.markov.the.save();
    assert.deepEqual(data, {
        stateSize: 1,
        counts: assert.markov.expected.counts,
        transitions: assert.markov.expected.transitions
    }, 'saved data matches');
    var copy = Markov.load(data);
    assert.deepEqual(copy.counts, assert.markov.expected.counts, 'loaded counts');
    assert.deepEqual(copy.transitions, assert.markov.expected.transitions, 'loaded transitions');
    assert.end();
});

markovTest('Markov createState', {
    markov1: null,
    markov2: {
        args: [{stateSize: 2}]
    },
    markov3: {
        args: [{stateSize: 3}]
    }
}, function(assert) {

    assert.equal(
        String(assert.markov1.the.createState('wat')),
        'wat',
        'markov1 createState wats'
    );

    assert.equal(
        String(assert.markov2.the.createState('wat')),
        ',wat',
        'markov2 createState wats'
    );

    assert.equal(
        String(assert.markov3.the.createState('wat')),
        ',,wat',
        'markov3 createState wats'
    );

    assert.equal(
        String(assert.markov1.the.createState('beep', 'boop')),
        'beep',
        'markov2 createState beeps but doesn\'t boop'
    );

    assert.equal(
        String(assert.markov2.the.createState('beep', 'boop')),
        'beep,boop',
        'markov2 createState beep boops'
    );

    assert.equal(
        String(assert.markov3.the.createState('beep', 'boop')),
        ',beep,boop',
        'markov3 createState beep boops'
    );

    assert.equal(
        String(assert.markov1.the.createState('beep', 'boop', 'blip')),
        'beep',
        'markov2 createState beeps but doesn\'t boop or blip'
    );

    assert.equal(
        String(assert.markov2.the.createState('beep', 'boop', 'blip')),
        'beep,boop',
        'markov2 createState beep and boops but doesn\'t blip'
    );

    assert.equal(
        String(assert.markov3.the.createState('beep', 'boop', 'blip')),
        'beep,boop,blip',
        'markov3 createState beep boops and blips'
    );


    assert.end();
});

markovTest('Markov merge', {
    markova: null,
    markovb: null,
    markovc: {args: [{stateSize: 2}]}
}, function(assert) {
    assert.markova.okStep({
        op: ['addTokens', ['this', 'is', 'a', 'testing', 'sentence']],
        expect: {
            counts: {
                this: 1,
                is: 1,
                a: 1,
                testing: 1,
                sentence: 1,
            },
            transitions: {
                '': ['this'],
                this: ['is'],
                is: ['a'],
                a: ['testing'],
                testing: ['sentence'],
                sentence: [null],
            }
        }
    });
    assert.markovb.okStep({
        op: ['addTokens', ['here', 'is', 'another', 'testing', 'sentence']],
        expect: {
            counts: {
                here: 1,
                is: 1,
                another: 1,
                testing: 1,
                sentence: 1,
            },
            transitions: {
                '': ['here'],
                here: ['is'],
                is: ['another'],
                another: ['testing'],
                testing: ['sentence'],
                sentence: [null],
            }
        }
    });
    assert.markova.the.merge(assert.markovb.the);
    assert.markova.okState('after markova.merge(markovb)', {
        counts: {
            this: 1,
            here: 1,
            is: 2,
            a: 1,
            another: 1,
            testing: 2,
            sentence: 2,
        },
        transitions: {
            '': ['here', 'this'],
            this: ['is'],
            here: ['is'],
            is: ['a', 'another'],
            a: ['testing'],
            another: ['testing'],
            testing: ['sentence'],
            sentence: [null],
        }
    });
    assert.throws(function() {
        assert.markova.the.merge(assert.markovc.the);
    }, /differing state size/, 'cannot merge different sized markovs');
    assert.end();
});

markovTest('Build a 2-markov', {
    markov: {
        args: [{stateSize: 2}]
    }
}, function(assert) {
    assert.markov.okSteps([
        {
            op: ['addTokens', 'now is the time for action'.split(' ')],
            expect: {
                counts: {
                    now: 1,
                    is: 1,
                    the: 1,
                    time: 1,
                    for: 1,
                    action: 1
                },
                transitions: {
                    ',': ['now'],
                    ',now': ['is'],
                    'now,is': ['the'],
                    'is,the': ['time'],
                    'the,time': ['for'],
                    'time,for': ['action'],
                    'for,action': [null]
                }
            }
        },

        {
            op: ['addTokens', 'tomorrow is the time for sleep'.split(' ')],
            expect: {
                counts: {
                    tomorrow: 1,
                    is: 2,
                    the: 2,
                    time: 2,
                    for: 2,
                    sleep: 1
                },
                transitions: {
                    ',': ['now', 'tomorrow'],
                    ',tomorrow': ['is'],
                    'tomorrow,is': ['the'],
                    'time,for': ['action', 'sleep'],
                    'for,sleep': [null]
                }
            }
        }

    ]);

    assert.end();
});

var Corpus = {
    vimLicense: [
        'there are no restrictions on distributing unmodified copies of vim except that they must include this license text',
        'you can also distribute unmodified parts of vim likewise unrestricted except that they must include this license text',
        'you are also allowed to include executables that you made from the unmodified vim sources plus your own usage examples and vim scripts',
        'it is allowed to distribute a modified version of vim including executables and source code when the following four conditions are met',
        'this license text must be included unmodified',
        'the modified vim must be distributed in one of the following five ways',
        'if you make changes to vim yourself you must clearly describe in the distribution how to contact you',
        'when the maintainer asks you  for a copy of the modified vim you distributed you must make your changes including source code available to the maintainer without fee',
        'the maintainer reserves the right to include your changes in the official version of vim',
        'what the maintainer will do with your changes and under what license they will be distributed is negotiable',
        'if there has been no negotiation then this license or a later version also applies to your changes',
        'the current maintainer is bram moolenaar',
        'if this changes it will be announced in appropriate places',
        'when it is completely impossible to contact the maintainer the obligation to send him your changes ceases',
        'once the maintainer has confirmed that he has received your changes they will not have to be sent again',
        'if you have received a modified vim that was distributed as mentioned under',
        'you are allowed to further distribute it unmodified as mentioned at',
        'if you make additional changes the text under a applies to those changes',
        'provide all the changes including source code with every copy of the modified vim you distribute',
        'this may be done in the form of a context diff',
        'you can choose what license to use for new code you add',
        'the changes and their license must not restrict others from making their own changes to the official version of vim',
        'when you have a modified vim which includes changes as mentioned under',
        'you can distribute it without the source code for the changes if the following three conditions are met',
        'the license that applies to the changes permits you to distribute the changes to the vim maintainer without fee or restriction and permits the vim maintainer to include the changes in the official version of vim without fee or restriction',
        'you keep the changes for at least three years after last distributing the corresponding modified vim',
        'when the maintainer or someone who you distributed the modified vim to asks you for the changes within this period you must make them available to him',
        'you clearly describe in the distribution how to contact you',
        'this contact information must remain valid for at least three years after last distributing the corresponding modified vim or as long as possible',
        'when the gnu general public license applies to the changes you can distribute the modified vim under the gnu gpl version 2 or any later version',
        'a message must be added at least in the output of the version command and in the intro screen such that the user of the modified vim is able to see that it was modified',
        'if you distribute a modified version of vim you are encouraged to use the vim license for your changes and make them available to the maintainer including the source code',
        'the preferred way to do this is by email or by uploading the files to a server and emailing the url',
        'if the number of changes is small emailing a context diff will do',
        'it is not allowed to remove this license from the distribution of the vim sources parts of it or from a modified version',
        'you may use this license for previous vim releases instead of the license that they came with at your option',
    ]
};

function rotatingSequence(seq) {
    var i = 0;
    var self = function() {
        var r = seq[i];
        i = (i + 1) % seq.length;
        return r;
    };
    self.reset = function() {
        i = 0;
    };
    self.set = function(j) {
        i = j;
    };
    return self;
}

test('Markov chain', function(assert) {
    var seq = rotatingSequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);

    var markov = new Markov();
    Corpus.vimLicense.forEach(function(sentence) {
        markov.addTokens(sentence.split(/\s+/));
    });

    assert.equal(
        markov.chain(5, null, seq).join(' '),
        'if the gnu general public'
    );
    seq.reset();

    assert.equal(
        markov.chain(10, null, seq).join(' '),
        'if the gnu general public license that was modified'
    );
    seq.reset();

    seq.set(4);
    assert.equal(
        markov.chain(10, null, seq).join(' '),
        'the output of vim you are also allowed to include'
    );
    seq.reset();

    assert.equal(
        markov.chain(10, markov.createState('what'), seq).join(' '),
        'license for at'
    );
    seq.reset();

    assert.end();
});

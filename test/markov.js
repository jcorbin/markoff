var Markov = require('../markov');
var createTestObjects = require('./object');

var markovTest = createTestObjects.wrapper({
    type: Markov,
    expected: function() {
        var start = new Array(this.args && this.args[0] && this.args[0].stateSize || 1);
        for (var i=0, n=start.length; i<n; i++) start[i] = null;
        start = String(start);
        var exp = {
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
        transitions: assert.markov.expected.transitions
    }, 'saved data matches');
    var copy = Markov.load(data);
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

var Markov = require('../markov');
var testObjectHarness = require('./async_object').harness;
var series = require('continuable-series');

var markovTest = testObjectHarness({
    type: Markov,
    init: 'init',
    async: {
        transitions: function(done) {
            this.getData(function(err, data) {
                done(err, data && data.transitions);
            });
        }
    },
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
    return assert.markov.okSteps([
        {
            op: ['addTokens', []]
        },
        {
            op: ['addTokens', 'this is a testing sentence'.split(' ')],
            expect: {
                transitions: {
                    '': [[1, 'this']],
                    this: [[1, 'is']],
                    is: [[1, 'a']],
                    a: [[1, 'testing']],
                    testing: [[1, 'sentence']],
                    sentence: [[1, null]],
                }
            }
        },
        {
            op: ['addTokens', 'here is another testing sentence'.split(' ')],
            expect: {
                transitions: {
                    '': [[1, 'here'], [1, 'this']],
                    here: [[1, 'is']],
                    is: [[1, 'a'], [1, 'another']],
                    another: [[1, 'testing']],
                    testing: [[2, 'sentence']],
                    sentence: [[2, null]],
                }
            }
        }
    ]);
});

markovTest('Markov special keywords', function(assert) {
    return assert.markov.okStep({
        op: ['addTokens', 'the token constructor is special'.split(' ')],
        expect: {
            transitions: {
                '': [[1, 'the']],
                the: [[1, 'token']],
                token: [[1, 'constructor']],
                constructor: [[1, 'is']],
                is: [[1, 'special']],
                special: [[1, null]]
            }
        },
    });
});

markovTest('Markov getData/fromData', function(assert) {
    return series(
        assert.markov.okStep({
            op: function setup(markov, done) {
                series(
                    markov.addTokens.bind(markov, 'a b c'.split(' ')),
                    markov.addTokens.bind(markov, 'a b d'.split(' ')),
                    markov.addTokens.bind(markov, 'c e g'.split(' '))
                )(done);
            },
            expect: {
                transitions: {
                    '': [[2, 'a'], [1, 'c']],
                    a: [[2, 'b']],
                    b: [[1, 'c'], [1, 'd']],
                    c: [[1, 'e'], [1, null]],
                    d: [[1, null]],
                    e: [[1, 'g']],
                    g: [[1, null]],
                }
            }
        }),
        function(next) {
            assert.markov.the.getData(function(err, data) {
                if (err) return next(err);
                assert.deepEqual(data, {
                    stateSize: 1,
                    transitions: assert.markov.expected.transitions
                }, 'saved data matches');
                Markov.fromData(data, function(err, copy) {
                    if (err) return next(err);
                    copy.getData(function(err, data) {
                        if (err) return next(err);
                        assert.deepEqual(data, {
                            stateSize: 1,
                            transitions: assert.markov.expected.transitions
                        }, 'reloaded transitions');
                        next();
                    });
                });
            });
        }
    );
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
});

markovTest('Markov merge', {
    markova: null,
    markovb: null,
    markovc: {args: [{stateSize: 2}]}
}, function(assert) {
    return series(
        assert.markova.okStep({
            op: ['addTokens', ['this', 'is', 'a', 'testing', 'sentence']],
            expect: {
                transitions: {
                    '': [[1, 'this']],
                    this: [[1, 'is']],
                    is: [[1, 'a']],
                    a: [[1, 'testing']],
                    testing: [[1, 'sentence']],
                    sentence: [[1, null]],
                }
            }
        }),
        assert.markovb.okStep({
            op: ['addTokens', ['here', 'is', 'another', 'testing', 'sentence']],
            expect: {
                transitions: {
                    '': [[1, 'here']],
                    here: [[1, 'is']],
                    is: [[1, 'another']],
                    another: [[1, 'testing']],
                    testing: [[1, 'sentence']],
                    sentence: [[1, null]],
                }
            }
        }),

        assert.markova.okStep({
            // jshint camelcase: false
            op: function markovA_merge_markovB(markova, done) {
                var markovb = assert.markovb.the;
                markova.merge(markovb, done);
            },
            expect: {
                transitions: {
                    '': [[1, 'here'], [1, 'this']],
                    this: [[1, 'is']],
                    here: [[1, 'is']],
                    is: [[1, 'a'], [1, 'another']],
                    a: [[1, 'testing']],
                    another: [[1, 'testing']],
                    testing: [[2, 'sentence']],
                    sentence: [[2, null]],
                }
            }
            // jshint camelcase: true
        }),

        // assert.markova.the.merge.bind(assert.markova.the, assert.markovb.the),
        // assert.markova.okState('after markova.merge(markovb)', {
        // }),

        function(next) {
            assert.markova.the.merge(assert.markovc.the, function(err) {
                assert.ok(err && /differing state size/.exec('' + err),
                    'cannot merge different sized markovs');
                next();
            });
        }
    );
});

markovTest('Build a 2-markov', {
    markov: {
        args: [{stateSize: 2}]
    }
}, function(assert) {
    return assert.markov.okSteps([
        {
            op: ['addTokens', 'now is the time for action'.split(' ')],
            expect: {
                transitions: {
                    ',': [[1, 'now']],
                    ',now': [[1, 'is']],
                    'now,is': [[1, 'the']],
                    'is,the': [[1, 'time']],
                    'the,time': [[1, 'for']],
                    'time,for': [[1, 'action']],
                    'for,action': [[1, null]]
                }
            }
        },

        {
            op: ['addTokens', 'tomorrow is the time for sleep'.split(' ')],
            expect: {
                transitions: {
                    ',': [[1, 'now'], [1, 'tomorrow']],
                    ',tomorrow': [[1, 'is']],
                    'tomorrow,is': [[1, 'the']],
                    'is,the': [[2, 'time']],
                    'the,time': [[2, 'for']],
                    'time,for': [[1, 'action'], [1, 'sleep']],
                    'for,sleep': [[1, null]]
                }
            }
        }
    ]);
});

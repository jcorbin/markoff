module.exports = AsyncTestObject;

var TestObject = require('./object');

var series = require('continuable-series');
var test = require('tape');
var util = require('util');
var inherits = util.inherits;

AsyncTestObject.harness = function testObjectHarness(defaultSpec, defaultNames) {
    defaultNames = TestObject.namesToSpec(defaultSpec, defaultNames);
    return function(desc, names, func) {
        var namedSpecs;
        if (typeof names === 'function') {
            func = names;
            namedSpecs = defaultNames;
        } else {
            namedSpecs = TestObject.namesToSpec(defaultSpec, names);
        }
        test(desc, function(assert) {
            var steps = Object.keys(namedSpecs).map(function(name) {
                var test = assert[name] = new AsyncTestObject(name, namedSpecs[name], assert);
                return test.init();
            });
            steps.push(function(next) {
                var cont = func(assert);
                if (typeof cont === 'function') {
                    cont(next);
                } else {
                    next();
                }
            });
            series(steps)(function(err) {
                assert.error(err, 'no general error during testing');
                assert.end();
            });
        });
    };
};

function AsyncTestObject(name, spec, assert) {
    TestObject.call(this, name, spec, assert);
}
inherits(AsyncTestObject, TestObject);

AsyncTestObject.prototype.init = function init() {
    var desc = util.format('inital %s object: %s', this.spec.type.name, this.name);
    var self = this;
    var steps = [
        function(next) {
            self.expected = self.initialExpectation();
            next();
        },
        this.okState(desc)
    ];
    if (this.spec.init) {
        var theInit = this.spec.init;
        if (typeof theInit === 'string') theInit = this.the[theInit];
        steps.push(theInit.bind(this.the));
    }
    return series(steps);
};

AsyncTestObject.prototype.okState = function okState(mess, expect) {
    if (!expect) return function(done) {done();};
    var self = this;
    return series(Object.keys(expect).map(function(key) {
        var async = self.spec.async && self.spec.async[key];
        if (async) {
            return function(next) {
                var get = async;
                if (typeof get === 'string') get = self.the[get];
                get.call(self.the, function(err, val) {
                    self.assert.error(err, 'no error getting ' + key);
                    if (!err) self.expectKey(expect, key, val, mess);
                    next();
                });
            };
        } else {
            return function(next) {
                self.expectKey(expect, key, self.the[key], mess);
                next();
            };
        }
    }));
};

AsyncTestObject.prototype.okStep = function okStep(spec, i) {
    var step = this.step(spec, i);
    return series(step.func, this.okState(step.desc, spec.expect));
};

AsyncTestObject.prototype.okSteps = function okSteps(steps) {
    return series(steps.map(this.okStep, this));
};

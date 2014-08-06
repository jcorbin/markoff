var nextTick = require('next-tick');
var series = require('continuable-series');

module.exports = once;

function once(cont) {
    if (Array.isArray(cont)) {
        cont = series(cont);
    } else if (arguments.length > 1) {
        cont = series.apply(null, arguments);
    }

    var Q = [];
    var it = series(
        function(next) {
            it = function(callback) {
                Q.push(callback);
            };
            next();
        },
        cont,
        function(next) {
            it = function(callback) {callback();};
            nextTick(function() {
                Q.forEach(function(callback) {
                    callback();
                });
            });
            next();
        }
    );
    return function(callback) {
        return it(callback);
    };
}

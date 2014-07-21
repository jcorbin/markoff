# markoff

<!--
    [![build status][build-png]][build]
    [![Coverage Status][cover-png]][cover]
    [![Davis Dependency status][dep-png]][dep]
-->

<!-- [![NPM][npm-png]][npm] -->

<!-- [![browser support][test-png]][test] -->

Markov Chaining

## Example

```js
var Markov = require("markoff");
var mark = new Markov();

[
  "the quick brown fox jumps",
  "be quick now",
  "now is the time for all good men"
].forEach(function(sentence) {
  mark.addTokens(sentence.split(/\s+/g));
});

console.log(mark.chain(4).join(' '));
// might print something like "be quick brown fox" or "the quick now is"
```

## Docs

### `var mark = new Markov(options)`

// TODO. State what the module does.

## Installation

`npm install markoff`

## Tests

`npm test`

## Contributors

 - Joshua T Corbin

## MIT Licenced

  [build-png]: https://secure.travis-ci.org/uber/markoff.png
  [build]: https://travis-ci.org/uber/markoff
  [cover-png]: https://coveralls.io/repos/uber/markoff/badge.png
  [cover]: https://coveralls.io/r/uber/markoff
  [dep-png]: https://david-dm.org/uber/markoff.png
  [dep]: https://david-dm.org/uber/markoff
  [test-png]: https://ci.testling.com/uber/markoff.png
  [tes]: https://ci.testling.com/uber/markoff
  [npm-png]: https://nodei.co/npm/markoff.png?stars&downloads
  [npm]: https://nodei.co/npm/markoff

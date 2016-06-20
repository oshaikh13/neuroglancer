var theData = require('./theData.json');

var express = require('express');
var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function (req, res) {
  res.send(theData);
});

app.listen(1337, function () {
  console.log('Example app listening on port 1337!');
});
#! /usr/local/bin/node

var series = require('run-series');
var n = require('numbro');

var dates = require('./isodate.js');
var ta = require('./technical.js');
var sentiment = require('./sentiment.js');
var markets = require('./markets.js');
var quotes = require('./quotes.js');
var instruments = require('./instruments.js');
var earnings = require('./earnings.js');
var strategy = require('./strategy.js');
var positions = require('./positions.js');
var rsa = require('./rsa.js');
var account = require('./account.js');
var actions = require('./actions.js');
var orders = require('./orders.js');
var conf = require('./conf.js');

var opt = require('node-getopt').create([
  ['t' , 'trade'               , 'trade mode (default = paper)'],
  ['s' , 'strategy=ARG'        , 'macd, sar, k39, slow_stoch (default k39)'],
  ['h' , 'help'                , 'display this help'],
]).bindHelp().parseSystem();

conf.trade = opt.options.trade;
conf.strategy = (opt.options.strategy) ? opt.options.strategy : 'default';
var clist = conf.list;

console.log("*** ROBINBOT ("+(conf.trade ? "trade" : "paper")+" mode) today: "+
    dates.today+" "+(new Date).toLocaleTimeString());
    
global.quandl = new require('quandl')({ auth_token: conf.quandl_token });

global.Robinhood = require('robinhood')(conf.robinhood_credentials, () => {
    var downloads = [
           cb => {
            instruments.download(clist, cb);
        }, cb => {
            positions.download(cb);
        }, cb => {
            account.download(cb);
        },cb => {
            orders.download(cb);
        }, cb => {
            sentiment.download(cb);
        }, cb => {
            quotes.download(clist, cb);
        }, cb => {
            markets.download(cb);
        },  cb => {
            earnings.download(clist, cb);
        }
    ];

    series(downloads, (err, results) => {
        if (err) { 
            console.error("Error:");
            console.error(err);
            process.exit();
        }
        rsa.calculate(clist);
        markets.analyse();
        strategy.run(clist.sort(rsa.sort));

        actions.align();
        console.log("CASH VALUE: "+account.cash);
        console.log("ASSET VALUE: "+actions.asset_value);
        actions.distribute_cash();
        actions.allocate_stops();
        
        let risk_val = n(actions.stop_risk).format('0.00')
        let risk_percent = n(100 * (risk_val / actions.asset_value)).format("0.00");
        console.log("RISK: "+risk_val+" ("+risk_percent+"%)");

        orders.prepare(actions.sell, actions.buy, actions.stop);
        orders.place();
    });
});

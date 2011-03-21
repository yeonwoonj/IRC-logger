var fs = require('fs');
var os = require('os');
var net = require('net');

// ----------------------------------------------------------------------------
// config

var con = net.createConnection(6667,'irc.freenode.net');
var kDEBUG = false;

var nick = 'nodebot';
var chan = '#NTGPRG';

var chatlogs = [];
var maxlines = 30;

var log_prefix = '/var/www/html/logs/ntgprg-';


// ----------------------------------------------------------------------------
// logging

function ISODateString(d){
 function pad(n){return n<10 ? '0'+n : n}
 return d.getFullYear()+'-'
        + pad(d.getMonth()+1)+'-'
        + pad(d.getDate());
}

function ISOTimeString(d){
 function pad(n){return n<10 ? '0'+n : n}
 return pad(d.getHours())+':'
        + pad(d.getMinutes())+':'
	+ pad(d.getSeconds());
}

function getFilename() {
 return log_prefix + ISODateString(new Date()) + '.log';
}

function logging(s) {
 var fn = getFilename();

 fs.open(fn, 'a', undefined, function(err,fd) {
  if (err) throw err;

  fs.writeSync(fd, '[' + ISOTimeString(new Date()) + '] ' + s + '\n');
  fs.closeSync(fd);
 });
}

// ----------------------------------------------------------------------------
// update recent chat logs

function update_chatlogs(log) {

 chatlogs.push(log);
 if (chatlogs.length > maxlines) {
   chatlogs.shift();
 }

}

// ----------------------------------------------------------------------------
// code
con.setEncoding('utf8');

con.addListener('connect', function() {
 // console.log('connected');
 con.write('NICK ' + nick + '\r\n');
 con.write('USER node node node NodeJS IRC BOT\r\n');
 con.write('JOIN ' + chan + '\r\n');
});

function sleep(secs) {
 var last = os.uptime();

 while (true) {
  var curr = os.uptime();
  var diff = curr - last;
  if (diff < 0 || diff >= secs) {
   return;
  }
 }
}

var stream = '';
con.addListener('data', function(data) {
 stream += data;

 while (true) {

  var pos = stream.indexOf('\r\n');
  if (pos == -1) {
   return;
  }

  line = stream.substring(0, pos);
  stream = stream.substr(pos+2);

  if (line.indexOf('PING') != -1) {
   var payload = 'PONG ' + line.split(/\s/)[1] + '\r\n';
   if (kDEBUG) console.log('>>> ' + payload);
   con.write(payload);
  }
  else if (line.indexOf('!nodebot quit') != -1) {
   var payload = 'PRIVMSG ' + chan + ' :bye\r\n';
   if (kDEBUG) console.log('>>> ' + payload);
   con.end(payload);
  }
  else if ((new RegExp('PRIVMSG ' + chan + ' :', 'i')).test(line)) {
   var who = line.substring(1, line.indexOf('!'));
   var chat = line.substr(line.indexOf(':',1));
   //con.write('PRIVMSG ' + chan + ' :' + who + chat + '\r\n');
   if (kDEBUG) console.log('>>> ' + who + chat);
   logging(who + chat);
   update_chatlogs(who + chat);
  }
  else if ((new RegExp('PART ' + chan, 'i')).test(line)) {
   var who = line.substring(1, line.indexOf('!'));
   var text = ' has left the channel';
   logging(who + text);
   update_chatlogs(who + text);
  }
  else if ((new RegExp('QUIT :', 'i')).test(line)) {
   var who = line.substring(1, line.indexOf('!'));
   var text = ' has quit the channel';
   logging(who + text);
   update_chatlogs(who + text);
  } 
  else if ((new RegExp('JOIN :' + chan, 'i')).test(line)) {
   var who = line.substring(1, line.indexOf('!'));
   var text = ' has joined the channel';
   if (kDEBUG) console.log('>>> ' + who + ',len=' + chatlogs.length);
   logging(who + text);
   if (chatlogs.length > 0) {
    for (var idx = 0; idx < chatlogs.length; idx++) {
     con.write('PRIVMSG ' + who + ' :' + chatlogs[idx] + '\r\n');
     sleep(1);
    }
    con.write('PRIVMSG ' + who + ' :recent ' + chatlogs.length + ' chat log' + (chatlogs.length > 1 ? 's' : '') + '. powered by node.js v0.4.1 ;-)\r\n');
   }
   update_chatlogs(who + text);
  }
  else {
   console.log(line);
  }

  if (kDEBUG) console.log(line);

 }

});

con.addListener('close', function(had_error) {
 console.log('connection closed: had_error=' + had_error);
 logging('connection closed: had_error=' + had_error);
});


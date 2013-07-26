/*
* Douban API v2 SDK
*/
var util = require('util');
var URL = require('url');

function OAuth2(clientId, clientSecret, customHeaders) {
  this._clientId= clientId;
  this._clientSecret= clientSecret;
  this._baseSite= 'https://www.douban.com';
  this._authorizeUrl= "/service/auth2/auth";
  this._accessTokenUrl= "/service/auth2/token";
  this._accessTokenName= "access_token";
  this._authMethod= "Bearer";
  this._customHeaders = {};
}
util.inherits(OAuth2, require('oauth').OAuth2);

OAuth2.prototype.clientFromToken = function(token) {
  var client = new Client(token, this);
  return client;
};

var SEVEN_DAYS = 60 * 60 * 24 * 7;
OAuth2.prototype.getToken = function(code, params, callback) {
  this.getOAuthAccessToken(code, params, function(err, access_token, refresh_token, results) {
    if (err) return callback(err);
    results = results || {};
    results.access_token = access_token;
    results.refresh_token = refresh_token;
    // 30 seconds is time gap of douban server and local server
    results.expire_date = new Date((+new Date() + (results.expires_in || SEVEN_DAYS) - 30) * 1000);
    return callback(null, results);
  });
};

/*
* get request client from token
*/
function Client(token, oauth2) {
  this.init(token);
  this.oauth2 = oauth2;
  this._accessTokenName = 'access_token';
  this._customHeaders = {};
}

Client.prototype.init = function(token) {
  token = token || {};
  this.access_token = token.access_token;
  this.refresh_token = token.refresh_token;
  this.user_id = token.douban_user_id;
  this.expire_date = token.expire_date;

  this._base_url = 'https://api.douban.com';
};

Client.prototype._request = OAuth2.prototype._request;
Client.prototype._executeRequest = OAuth2.prototype._executeRequest;

Client.prototype._auth_headers = function() {
  if (!this.access_token) return {};
  return {
    'Authorization': 'Bearer ' + this.access_token
  };
};

Client.prototype.isExpired = function() {
  return this.dead || this.expire_date < new Date();
};

Client.prototype.request = function(method, url, data, callback) {
  var self = this;

  if (typeof data === 'function') {
    callback = data;
    data = '';
  }

  method = method.toUpperCase();

  var parsed_url = URL.parse(self._base_url + url);

  var qs = parsed_url.query || {};
  if (self.oauth2) {
    qs.apikey = qs.client_id = self.oauth2._clientId;
  }
  if (method === 'GET' && data) {
    for (var k in data) {
      qs[k] = data[k];
    }
    data = '';
  }
  parsed_url.query = qs;

  function run() {
    self.oauth2._request(method, URL.format(parsed_url),
    self._auth_headers(), data, self.access_token || '', function(err, body, res) {
      if (err) return callback(err);
      try {
        ret = JSON.parse(body);
      } catch (e) {}
      callback(err, ret, res);
    });
  }

  // if has expired
  if (self.isExpired()) {
    self.refresh(function(err, new_token) {
      if (err || !new_token) {
        self.dead = true;
        return;
      }
      self.init(new_token) = new_token;
      run();
    });
  } else {
    run();
  }
};

Client.prototype.refresh = function(cb) {
  var self = this;
  this.oauth2.getToken(self.refresh_token, {
    grant_type: 'refresh_token',
  }, function(err, new_token) {
    if (err) {
      self.emit('refresh_error', error);
    } else {
      self.emit('refresh', new_token);
    }
    return cb(err, new_token);
  });
};

['get', 'delete', 'head'].forEach(function(item) {
  Client.prototype[item] = function(url, callback) {
    this.request(item, url, "", callback);
  };
});
['post', 'put'].forEach(function(item) {
  Client.prototype[item] = function(url, data, callback) {
    this.request(item, url, data, callback);
  };
});

var conf = require('../../conf');

module.exports = function(clientId, clientSecret) {
  clientId = clientId || conf.douban.key;
  clientSecret = clientSecret || conf.douban.secret;
  return new OAuth2(clientId, clientSecret);
};

module.exports.Client = Client;
module.exports.OAuth2 = OAuth2;

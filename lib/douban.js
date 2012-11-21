// Douban Event Api
var wx_request = require('weixin-robot').request;
var conf = require('../conf');

function request(url, param){
  param.apikey = conf.douban.apikey;
  wx_request.apply(wx_request, arguments);
}

var debug = require('debug');
var log = debug('weixin:douban');
var error = debug('weixin:douban:error');

var douban = {
  eventDesc: function eventDesc(item) {
    return item.owner.name + ' / ' +
    (item.participant_count + item.wisher_count) + '人关注 / ' + item.address;
  },
  'list': function(param, next) {
    if (!param) return next(400);
    if (!param['loc'] && param['type']) return next('CITY_FIRST');

    if (!param['count']) {
      param['count'] = (!param['type'] || param['type'] == 'all') ? 20 : 10;
    }

    request('GET https://api.douban.com/v2/event/list', param, function(err, ret) {
      if (err == 404) return next(err);
      if (err || !ret.events) return next(503);
      if (!ret.events.length) next(404);
      next(err, ret.events.sample(6));
    });
  },
  'search': function(param, next) {
    if (!param || !param['q'] || !param['loc']) return next(400);

    param['count'] = param['count'] || 15;
    request('GET https://api.douban.com/v2/event/search', param, function(err, ret) {
      if (err === 404) return next(err);
      if (err || !ret.events) return next(503);
      if (!ret.events.length) next(404);
      next(err, ret.events.sample(5));
    });
  },
  'nearby': function(param, next) {
    if (!param['loc']) return next('GEO_404');

    param['count'] = param['count'] || 8;
    var has_day = 'day_type' in param;

    var fn = function(day_type) {
      if (day_type) param['day_type'] = day_type;
      request('GET https://api.douban.com/v2/event/nearby', param, cb);
    };

    var cb = function(err, ret) {
      // 附近今天的活动只有一个
      if (!has_day && param['day_type'] == 'today') {
        if (!err == 404 || ret && ret.events && ret.events.length < 2) {
          return fn('future');
        }
      }
      if (err === 404) return next('GEO_404');
      if (err || !ret.events) return next(503);
      if (!ret.events.length) return next('GEO_404');
      next(err, ret.events.sample(5));
    }
    // 未指定时间时，优先取今日
    fn(has_day ? null : 'today');
  }
};

module.exports = douban;

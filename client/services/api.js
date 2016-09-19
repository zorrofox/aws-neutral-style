angular.module('Instagram')
  .factory('API', function($http) {

    return {
      getFeed: function() {
        return $http.get('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/feed');
      },
      getFeedStyle: function() {
        return $http.get('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/feed?type=style');
      },
      getFeedOutput: function() {
        return $http.get('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/feed?type=output');
      },
      getMediaById: function(id) {
        return $http.get('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/media?key=' + id);
      },
      getUploadUrl: function(type, key, contentType) {
        return $http.post('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/upload', {
          type: type,
          key: key,
          contentType: contentType
        });
      },
      runGPUCmd: function(key) {
        return $http.post('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/rungpu', {
          key: key
        });
      },
      listGPUCmd: function() {
        return $http.get('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/rungpu');
      },
      delete: function(type, key) {
        return $http.delete('https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/api/upload?key=' 
          + key + '&type=' + type);
      }
    }

  });
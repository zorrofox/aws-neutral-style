angular.module('Instagram')
  .controller('HomeCtrl', function($scope, $window, $rootScope, $auth, API, FileUploader) {

    if ($auth.isAuthenticated() && ($rootScope.currentUser && $rootScope.currentUser.email)) {
      API.getFeed().success(function(data) {
        $scope.photos = data;
      });

      API.getFeedStyle().success(function(data) {
        $scope.origPhotos = data;
      });

      API.getFeedOutput().success(function(data) {
        $scope.outPhotos = data;
      });

      $scope.isAuthenticated = function() {
        return $auth.isAuthenticated();
      };

      var uploader = $scope.uploader = new FileUploader({
        method: "PUT",
        disableMultipart: true
      });

      var uploaderStyle = $scope.uploaderStyle = new FileUploader({
        method: "PUT",
        disableMultipart: true
      });


      // FILTERS

      uploader.filters.push({
        name: 'customFilter',
        fn: function(item /*{File|FileLikeObject}*/ , options) {
          return this.queue.length < 2;
        }
      });

      uploaderStyle.filters.push({
        name: 'customFilter',
        fn: function(item /*{File|FileLikeObject}*/ , options) {
          return this.queue.length < 2;
        }
      });

      // CALLBACKS

      $scope.fileUrlReady = true;
      $scope.fileUrlStyleReady = true;
      uploader.onAfterAddingFile = function(fileItem) {
        console.log(fileItem.url);
        fileItem.url = '/';
        API.getUploadUrl('ORIGINAL', fileItem.file.name, fileItem.file.type).success(function(url) {

          fileItem.url = url.replace(/\"/g, "");
          if (url)
            $scope.fileUrlReady = false;
        });
      };

      uploaderStyle.onAfterAddingFile = function(fileItem) {
        console.log(fileItem.url);
        fileItem.url = '/';
        API.getUploadUrl('STYLE', fileItem.file.name, fileItem.file.type).success(function(url) {

          fileItem.url = url.replace(/\"/g, "");
          if (url)
            $scope.fileUrlStyleReady = false;
        });
      };

      $scope.delOrig = function(key) {
        API.delete('ORIGINAL', key).success(function(data) {
          var f = -1;
          for (var i = 0; i < $scope.photos.length; i++)
            if ($scope.photos[i].Key === key) {
              f = i;
              break;
            }
          $scope.photos.splice(f, 1);
        });
      };

      $scope.delStyle = function(key) {
        API.delete('STYLE', key).success(function(data) {
          var f = 999999999;
          for (var i = 0; i < $scope.origPhotos.length; i++)
            if ($scope.origPhotos[i].Key === key) {
              f = i;
              break;
            }
          $scope.origPhotos.splice(f, 1);
        });
      };

    }

  });
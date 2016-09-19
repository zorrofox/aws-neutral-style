angular.module('Instagram')
  .controller('DetailCtrl', function($scope, $rootScope, $location, API) {

    var mediaId = $location.path().split('/').pop();

    $scope.enableRun = true;

    API.getMediaById(mediaId).success(function(media) {
      $scope.photo = media;
      $scope.photo.mediaId = mediaId;
    });

    API.getFeedStyle().success(function(data) {
      $scope.stylePhotos = data;
    });

    API.getFeedOutput().success(function(data) {
      $scope.outPhotos = data;
    });

    API.listGPUCmd().success(function(data){
      $scope.enableRun = data.inProcess;
    });

    $scope.runGPUCmd = function() {
      API.runGPUCmd(mediaId).success(function(data) {
        $scope.runGPUCmdSuccess = (data.StatusCode === 200 && data.Payload.message === "Run command successful");

      });

      $scope.enableRun = true;
    };

  });
angular.module('Instagram', ['ngRoute', 'angularFileUpload', 'ngMessages', 'satellizer'])
  .config(function($routeProvider, $authProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/home.html',
        controller: 'HomeCtrl'
      })
      .when('/login', {
        templateUrl: 'views/login.html',
        controller: 'LoginCtrl'
      })
      .when('/signup', {
        templateUrl: 'views/signup.html',
        controller: 'SignupCtrl'
      })
      .when('/photo/:id', {
        templateUrl: 'views/detail.html',
        controller: 'DetailCtrl'
      })
      .otherwise('/');

    $authProvider.loginUrl = 'https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/auth/login';
    $authProvider.signupUrl = 'https://au2jjdhqfl.execute-api.ap-northeast-1.amazonaws.com/dev/auth/signup';


  })
  .filter('keyDotless', function() {
    return function(input, key) {
      if (input && key) {
        for (var i=0; i<input.length; i++)
          if(input[i].Key.indexOf(key.replace(/\./g, '')) < 0)
            input.splice(i, 1);
        return input;
      }
    }
  })
  .run(function($rootScope, $window, $auth) {
    if ($auth.isAuthenticated()) {
      $rootScope.currentUser = JSON.parse($window.localStorage.currentUser);
    }
  });
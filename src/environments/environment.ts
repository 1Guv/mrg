// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "AIzaSyDw-BcCYPJuvZW7FfTOoGSBzzilKPaeNmY",
    authDomain: "card-shark-1.firebaseapp.com",
    projectId: "card-shark-1",
    storageBucket: "card-shark-1.firebasestorage.app",
    messagingSenderId: "78889961943",
    appId: "1:78889961943:web:2e4625050f982a66b16392",
    measurementId: "G-60RF163VQ8"
  },
  stripe: {
    publishableKey: 'pk_test_51OuG6TEi1sf3ZM0t4Razx6wnAKZ6Y2qDMBdJUby9SDmgZdQ3sZZMLYKea0e4tGZqc2ayYuvRx2h2rPdTHXC3907g00T9jfx6fN',
    secretKey: 'sk_test_51OuG6TEi1sf3ZM0t1tFmNfyBbV3rjHR3pI9DlhhlMTYtuZ3qY2klmITfkdngd71tjX0Ssxt6lyqrddmQGOe5LVVA006QzQJu6v'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

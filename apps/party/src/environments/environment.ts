// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  bungie: {
    apiKey: '2cbdc69e9a224c2182f5860de312d778',
    authUrl: 'https://www.bungie.net/en/OAuth/Authorize',
    clientId: '36110',
    clientSecret: 'tcrIbt-EhSqtWN8joYh.XpezwbfO2-K8bm3nv.r0RL4',
    redirect: 'https://localhost:4200',
  },
  turn: {
    username: 'a063f6846bc232fbfbb91479',
    credential: 'Klw2Mttx438HCeMH',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

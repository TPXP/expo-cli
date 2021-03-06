'use strict';

const { join } = require('path');
const { version } = require('./package');

const TRAVELING_FASTLANE = `traveling-fastlane-${version}-osx`;

module.exports = () => {
  let p = join.bind(null, __dirname, TRAVELING_FASTLANE);
  return {
    authenticate: p('authenticate'),
    ensureAppExists: p('ensure_app_exists'),
    manageDistCerts: p('manage_dist_certs'),
    managePushKeys: p('manage_push_keys'),
    manageProvisioningProfiles: p('manage_provisioning_profiles'),
    appProduce: p('app_produce'),
    pilotUpload: p('pilot_upload'),
    supplyAndroid: p('supply_android'),
  };
};

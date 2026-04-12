// Electron production entrypoint
// Keep this file minimal and delegate app bootstrap to CLOUDCODE.js
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

require('./CLOUDCODE');

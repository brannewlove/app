const path = require('path');

module.exports = {
    apps: [{
        name: "vue-backend",
        script: "./backend/server.js",
        cwd: "D:/Code/vue_dbas",
        env: {
            NODE_ENV: "production",
            PORT: 3000
        }
    }]
}

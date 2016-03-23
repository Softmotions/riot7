

## Prerequisites

Dependencies:

    npm install --save browserify browserify-shim dateformat async riot framework7 validate-js


Modify `package.json`:

    "browserify-shim": {
        "Framework7": "global:Framework7",
        "Template7": "global:Template7",
        "Dom7": "global:Dom7"
    }


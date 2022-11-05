// @ts-check

const gFilereader = require('fs');

/**
 * Get project name.
 */
const gGetProjectName = () => {
    const lFileContent = gFilereader.readFileSync("package.json", 'utf8');
    const lFileJson = JSON.parse(lFileContent);

    return lFileJson.projectName;
};

module.exports = {
    "require": [
        "jsdom-global/register"
    ],
    "file": [`library/build/test-pack.js`],
    "parallel": false
};
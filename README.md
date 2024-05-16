# Requirements:
- node
- npm

To install Node.js and npm on Ubuntu, you can use the following script:
`curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -`

* To remove any previously installed versions of Node.js, you can use:
`sudo apt-get purge --auto-remove nodejs`

# Prepare:
- Add your personal data to the `local_config.json` file.
- Install npm dependencies using: `npm install`
- Add a cron job to run the script automatically. `0 9,18 * * 1-5` (on 9:00h and 18:00h, every weekday)
- Manually execute `node autopunch.js`
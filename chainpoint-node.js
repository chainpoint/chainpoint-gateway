#!/usr/bin/env node

// load environment variables
const env = require('./lib/parse-env.js')

const _ = require('lodash')
const yargs = require('yargs')
const startCmd = require('./lib/start.js')

let argv = yargs
  .usage('Usage: ' + require.main.filename.split('/').pop().slice(0, -3) + ' [command] [options] <argument>')
  .option('s', {
    alias: 'server',
    requiresArg: true,
    default: env.CHAINPOINT_API_BASE_URI,
    description: 'specify server to use',
    type: 'string'
  })
  .command('start', false, (yargs) => { // description is false to hide from help content
    let argv = yargs
      .argv
    startCmd.execute(yargs, argv)
  })
  .help('help', 'show help')
  .argv

function parseCommand (yargs, argv) {
  if (argv._.length > 0) {
    // check for unknown command
    let command = _.lowerCase(argv._[0])
    if (_.indexOf(['start'], command) < 0) {
      yargs.showHelp()
      console.log(`Unknown command: ${command}`)
    }
  } else {
    // no command was specified, default to 'start'
    startCmd.execute(yargs, argv)
  }
}

// parse cli command and display error message on bad command
parseCommand(yargs, argv)

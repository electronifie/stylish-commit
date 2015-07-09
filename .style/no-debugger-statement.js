module.exports = {
  name: 'no-debugger-statement',
  appliesTo: '**/*.js',
  validate: { replace: /\s*debugger;\s*/, with: '' }
};

/* global describe, it, context */

var expect = require('chai').expect
var join = require('path').join
var rewire = require('rewire')
var dt2js = rewire('../src/dt2js')
var constants = require('../src/constants')
var fs = require('fs')

var RAML_FILE_NAME = join(__dirname, 'examples/types_example.raml')

describe('dt2js.getRAMLContext()', function () {
  var getRAMLContext = dt2js.__get__('getRAMLContext')
  it('should get raml data types context from RAML content', function () {
    var ramlData = fs.readFileSync(RAML_FILE_NAME).toString()
    var ctx = getRAMLContext(ramlData)
    expect(ctx).to.be.an('object').and.contain.keys('Cat')
  })
})

describe('dt2js.dt2js()', function () {
  var ramlData = fs.readFileSync(RAML_FILE_NAME).toString()
  context('when applied to valid type', function () {
    it('should produce valid JSON schema', function () {
      dt2js.dt2js(ramlData, 'Cat', function (err, schema) {
        expect(schema).to.have.property(
            '$schema', 'http://json-schema.org/draft-04/schema#').and
        expect(schema).to.have.property('type', 'object')
        expect(err).to.be.nil
      })
    })
  })
  context('when applied to invalid type', function () {
    it('should not produce valid JSON schema', function () {
      dt2js.dt2js(ramlData, 'InvalidCat', function (err, schema) {
        expect(schema).to.be.nil
        expect(err).to.not.be.nil
      })
    })
  })
  context('when applied to invalid RAML data', function () {
    it('should return error and null', function () {
      dt2js.dt2js('asdasdasdasd', 'Cat', function (err, schema) {
        expect(schema).to.be.nil
        expect(err).to.not.be.nil
        expect(err).to.have.property('message', 'Invalid RAML data')
      })
    })
  })
})

describe('dt2js.addRootKeywords()', function () {
  var addRootKeywords = dt2js.__get__('addRootKeywords')
  it('should add missing root keywords', function () {
    var schema = addRootKeywords({})
    expect(schema)
      .to.be.an('object').and
      .to.have.property(
        '$schema', 'http://json-schema.org/draft-04/schema#')
  })
})

describe('dt2js.processArray()', function () {
  var processArray = dt2js.__get__('processArray')
  it('should transform each element of array', function () {
    var result = processArray(
      [{'type': 'union'}, {'type': 'nil'}], [])
    expect(result).to.have.lengthOf(2)
    expect(result).to.have.deep.property('[0].type', 'object')
    expect(result).to.have.deep.property('[1].type', 'null')
  })
})

describe('dt2js.convertType()', function () {
  var convertType = dt2js.__get__('convertType')
  it('should change type `union` to `object`', function () {
    var obj = convertType({'type': 'union'})
    expect(obj).to.deep.equal({'type': 'object'})
  })
  it('should change type `nil` to `null`', function () {
    var obj = convertType({'type': 'nil'})
    expect(obj).to.deep.equal({'type': 'null'})
  })
  it('should change type `file` to `string` with `media` keyword', function () {
    var obj = convertType({'type': 'file'})
    expect(obj).to.deep.equal(
      {'type': 'string', 'media': {'binaryEncoding': 'binary'}})
  })
  context('when does not match any type', function () {
    it('should return object not changed', function () {
      var obj = convertType({'type': 'foobar'})
      expect(obj).to.deep.equal({'type': 'foobar'})
    })
  })
})

describe('dt2js.convertFileType()', function () {
  var convertFileType = dt2js.__get__('convertFileType')
  it('should change type `file` to `string` with `media` keyword', function () {
    var expected = {'type': 'string', 'media': {'binaryEncoding': 'binary'}}
    var obj = convertFileType({'type': 'file'})
    expect(obj).to.deep.equal(expected)
  })
  context('when data contains `fileTypes` param', function () {
    it('should move its elements to anyOf and delete `fileTypes`', function () {
      var expected = {
        'type': 'string',
        'media': {
          'binaryEncoding': 'binary',
          'anyOf': [
            {'mediaType': 'image/jpeg'},
            {'mediaType': 'image/png'}
          ]
        }
      }
      var obj = convertFileType({
        'type': 'file',
        'fileTypes': ['image/jpeg', 'image/png']
      })
      expect(obj).to.deep.equal(expected)
    })
  })
})

describe('dt2js.convertDateType()', function () {
  var convertDateType = dt2js.__get__('convertDateType')
  it('should change type `date-only` to `string` with pattern', function () {
    var obj = convertDateType({'type': 'date-only'})
    expect(obj).to.have.property('type', 'string')
    expect(obj).to.have.property('pattern', constants.dateOnlyPattern)
  })
  it('should change type `time-only` to `string` with pattern', function () {
    var obj = convertDateType({'type': 'time-only'})
    expect(obj).to.have.property('type', 'string')
    expect(obj).to.have.property('pattern', constants.timeOnlyPattern)
  })
  it('should change type `time-only` to `string` with pattern', function () {
    var obj = convertDateType({'type': 'datetime-only'})
    expect(obj).to.have.property('type', 'string')
    expect(obj).to.have.property('pattern', constants.dateTimeOnlyPattern)
  })
  context('when type is `datetime`', function () {
    var data = [
      {
        'setTo': 'undefined',
        'input': {'type': 'datetime'},
        'pattern': constants.RFC3339DatetimePattern
      }, {
        'setTo': 'rfc3339',
        'input': {'type': 'datetime', 'format': 'rfc3339'},
        'pattern': constants.RFC3339DatetimePattern
      }, {
        'setTo': 'rfc2616',
        'input': {'type': 'datetime', 'format': 'rfc2616'},
        'pattern': constants.RFC2616DatetimePattern
      }
    ]
    data.forEach(function (el) {
      context('when `format` is set to ' + el.setTo, function () {
        it('should change type to `string` with pattern', function () {
          var obj = convertDateType(el.input)
          expect(obj).to.have.property('type', 'string')
          expect(obj).to.have.property('pattern', el.pattern)
          expect(obj).to.not.have.property('format')
        })
      })
    })
  })
  context('when does not match any type', function () {
    it('should return object not changed', function () {
      var obj = convertDateType({'type': 'foobar'})
      expect(obj).to.deep.equal({'type': 'foobar'})
    })
  })
})

describe('dt2js.processNested()', function () {
  var processNested = dt2js.__get__('processNested')
  it('should process nested arrays', function () {
    var data = {'foo': [{'type': 'union'}]}
    var result = processNested(data, [])
    expect(result)
      .to.have.property('foo').and
      .to.have.lengthOf(1)
    expect(result).to.have.deep.property('foo[0].type', 'object')
  })
  it('should process nested objects', function () {
    var data = {'foo': {'type': 'union'}}
    var result = processNested(data, [])
    expect(result)
      .to.have.property('foo').and
      .to.have.all.keys('type')
    expect(result).to.have.deep.property('foo.type', 'object')
  })
  it('should return empty object if no nesting is present', function () {
    var result = processNested({'type': 'union'}, [])
    expect(result).to.be.deep.equal({})
  })
})

describe('dt2js.schemaForm()', function () {
  var schemaForm = dt2js.__get__('schemaForm')
  it('should return data unchanged if it is not Object', function () {
    var result = schemaForm('foo')
    expect(result).to.be.equal('foo')
  })
  it('should hoist `required` properties param to object root', function () {
    var data = {
      'type': 'object',
      'properties': {
        'name': {
          'type': 'string',
          'required': true
        },
        'age': {
          'type': 'integer',
          'required': true
        },
        'address': {
          'type': 'string'
        }
      }
    }
    var schema = schemaForm(data, [])
    expect(schema)
      .to.have.property('required').and
      .to.be.deep.equal(['name', 'age'])
  })
  it('should remove `required` properties param while hoisting', function () {
    var data = {
      'type': 'object',
      'properties': {
        'name': {
          'type': 'string',
          'required': true
        }
      }
    }
    var schema = schemaForm(data, [])
    expect(schema)
      .to.have.property('required').and
      .to.be.deep.equal(['name'])
    expect(schema).to.not.have.deep.property('properties.name.required')
  })
  context('when `required` param is not used properly', function () {
    it('should not hoist `required` properties param', function () {
      var data = {
        'type': 'object',
        'properties': {
          'names': {
            'type': 'array',
            'items': [{
              'type': 'object',
              'required': true
            }]
          }
        }
      }
      var schema = schemaForm(data, [])
      expect(schema)
        .to.have.property('required').and
        .to.be.deep.empty
    })
  })
  it('should process nested', function () {
    var data = {
      'type': 'object',
      'properties': {
        'bio': {
          'type': 'object',
          'properties': {
            'event': {'type': 'date-only'}
          }
        },
        'siblings': {
          'anyOf': [{'type': 'nil'}]
        }
      }
    }
    var schema = schemaForm(data, [])
    expect(schema).to.have.deep.property(
      'properties.bio.properties.event.type', 'string')
    expect(schema).to.have.deep.property(
      'properties.siblings.anyOf[0].type', 'null')
  })
  it('should change types', function () {
    var data = {
      'type': 'union',
      'properties': {
        'name': {'type': 'nil'},
        'photo': {'type': 'file'},
        'dob': {'type': 'date-only'}
      }
    }
    var schema = schemaForm(data, [])
    expect(schema).to.have.property('type', 'object')
    expect(schema).to.have.deep.property('properties.name.type', 'null')
    expect(schema).to.have.deep.property('properties.photo.type', 'string')
    expect(schema).to.have.deep.property('properties.photo.media')
    expect(schema).to.have.deep.property('properties.dob.type', 'string')
  })
})

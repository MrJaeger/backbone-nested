/**
 * Backbone-Nested 1.1.2 - An extension of Backbone.js that keeps track of nested attributes
 *
 * http://afeld.github.com/backbone-nested/
 *
 * Copyright (c) 2011-2012 Aidan Feldman
 * MIT Licensed (LICENSE)
 */
/*global $, _, Backbone */
(function(){
  'use strict';
  
  var _delayedTriggers = []

  Backbone.NestedModel = Backbone.Model.extend({
    
    get: function(attrStrOrPath){
      var attrPath = (typeof(attrStrOrPath) === 'Array' ? attrStrOrPath : Backbone.NestedModel.attrPath(attrStrOrPath)),
        childAttr = attrPath[0],
        result = Backbone.NestedModel.__super__.get.call(this, childAttr);
      
      if(result instanceof Backbone.NestedModel && attrPath.length > 1)
        return result.get(attrPath.slice(1));

      // walk through the child attributes
      for (var i = 1; i < attrPath.length; i++){
        if (!result){
          // value not present
          break;
        }
        childAttr = attrPath[i];
        var log = result[childAttr];  
        if(result[childAttr] instanceof Backbone.NestedModel) {
          result = result[childAttr].get(attrPath.slice(i+1));
          break;
        }
        result = result[childAttr];
      }

      return result;
    },

    has: function(attr){
      // for some reason this is not how Backbone.Model is implemented - it accesses the attributes object directly
      var result = this.get(attr);
      return !(result === null || _.isUndefined(result));
    },

    set: function(key, value, opts){
      var newAttrs = Backbone.NestedModel.deepClone(this.attributes)
        , counter = 0
        , nestedModelFound
        , _super = this;

      var checkForNestedModels = function(attrPath, val) {
        if(attrPath.length === 1 && attrPath[0] instanceof Backbone.NestedModel) return true;
        for(;counter < attrPath.length-1; counter++) {
          var attr = newAttrs[attrPath[counter]]
          if(attr instanceof Backbone.NestedModel) {
            attr.set(attrPath.slice(counter+1),val,opts);
            return true;
          }
        }
        return false;
      };

      if (_.isString(key)){
        // Backbone 0.9.0+ syntax: `model.set(key, val)` - convert the key to an attribute path
        key = Backbone.NestedModel.attrPath(key);
      }

      if (_.isArray(key)){
        // attribute path
        nestedModelFound = checkForNestedModels(key, value);
        if(!nestedModelFound)
          this._mergeAttr(newAttrs, key, value, opts);
      } else { // it's an Object
        opts = value;
        var attrs = key,
          attrPath;

        for (var attrStr in attrs){
          attrPath = Backbone.NestedModel.attrPath(attrStr);
          nestedModelFound = checkForNestedModels(attrPath, attrs[attrStr]);
          nestedModelFound ? Backbone.NestedModel.__super__.set.call(this, attrs[attrStr], opts) : this._mergeAttr(newAttrs, attrPath, attrs[attrStr], opts);
        }
      }
      var setReturn = Backbone.NestedModel.__super__.set.call(this, newAttrs, opts);
      this._runDelayedTriggers();
      this._updateNestedModels();
      return setReturn;
    },

    unset: function(attrStr, opts){
      opts = _.extend({}, opts, {unset: true});
      this.set(attrStr, null, opts);

      return this;
    },

    add: function(attrStr, value, opts){
      var current = this.get(attrStr);
      if (!_.isArray(current)) throw new Error('current value is not an array');
      return this.set(attrStr + '[' + current.length + ']', value, opts);
    },

    remove: function(attrStr, opts){
      opts = opts || {};

      var attrPath = Backbone.NestedModel.attrPath(attrStr),
        aryPath = _.initial(attrPath),
        val = this.get(aryPath),
        i = _.last(attrPath);

      if (!_.isArray(val)){
        throw new Error("remove() must be called on a nested array");
      }

      // only trigger if an element is actually being removed
      var trigger = !opts.silent && (val.length >= i + 1),
        oldEl = val[i];

      // remove the element from the array
      val.splice(i, 1);
      this.set(aryPath, val, opts);

      if (trigger){
        this.trigger('remove:' + Backbone.NestedModel.createAttrStr(aryPath), this, oldEl);
      }

      return this;
    },

    nestedModelCall: function(func) {
      for(var i = 0; i < this._nestedModels.length; i++) {
        var model = this.get(this._nestedModels[i]);
        model[func].call(model);
      }
    },
    
    save: function(key, value, options){
      Backbone.NestedModel.__super__.save.call(this, key, value, options);
      this.nestedModelCall('save');
    },

    destroy: function(options){
      Backbone.NestedModel.__super__.destroy.call(this, options);
      this.nestedModelCall('destroy');
    },

    fetch: function(options){
      Backbone.NestedModel.__super__.fetch.call(this, options);
      this.nestedModelCall('fetch');
    },

    toJSON: function(){
      return Backbone.NestedModel.deepClone(this.attributes);
    },


    // private
    _delayedTrigger: function(/* the trigger args */){
      _delayedTriggers.push(arguments);
    },

    _runDelayedTriggers: function(){
      while (_delayedTriggers.length > 0){
        this.trigger.apply(this, _delayedTriggers.shift());
      }
    },

    // note: modifies `newAttrs`
    _mergeAttr: function(newAttrs, attrPath, value, opts){
      var attrObj = Backbone.NestedModel.createAttrObj(attrPath, value);
      this._mergeAttrs(newAttrs, attrObj, opts);
    },

    // note: modifies `dest`
    _mergeAttrs: function(dest, source, opts, stack){
      opts = opts || {};
      stack = stack || [];

      _.each(source, function(sourceVal, prop){
        var destVal = dest[prop],
          newStack = stack.concat([prop]),
          attrStr;

        if (_.isArray(sourceVal) && !_.isArray(destVal)){
          // assigning an array to a previously non-array value
          destVal = dest[prop] = [];
        }

        if (prop in dest && _.isObject(sourceVal) && _.isObject(destVal)){
          // both new and original are objects/arrays, and thus need to be merged
          destVal = dest[prop] = this._mergeAttrs(destVal, sourceVal, opts, newStack);
        } else {
          // new value is a primitive
          var oldVal = destVal;

          destVal = dest[prop] = sourceVal;

          if (_.isArray(dest) && !opts.silent){
            attrStr = Backbone.NestedModel.createAttrStr(stack);

            if (!oldVal && destVal){
              var attrKey = attrStr;
              this._delayedTrigger('add:' + attrKey, this, destVal);
            } else if (oldVal && !destVal){
              this.trigger('remove:' + attrStr, this, oldVal);
            }
          }
        }
        
        // let the superclass handle change events for top-level attributes
        if (!opts.silent && newStack.length > 1){
          attrStr = Backbone.NestedModel.createAttrStr(newStack);
          this.trigger('change:' + attrStr, this, destVal);
          this.changed[attrStr] = destVal;
        }
      }, this);

      return dest;
    },

    _updateNestedModels: function() {
      var _super = this
        , atts = _super.attributes;
      _super._nestedModels = _super._nestedModels || [];
      for(var att in atts) {
        if(atts[att] instanceof Backbone.NestedModel && _super._nestedModels.indexOf(att) === -1) {
          atts[att].on('all', function(eventName, model, text) {
            var colon = eventName.indexOf(':');
            if(colon !== -1) {
              var realEventName = eventName.substring(0, colon+1) + att + '.' + eventName.substring(colon+1);
              _super.trigger(realEventName, model, text);
              _super.trigger(eventName.substring(0,colon+1) + att, model, text)
            } else {
              _super.trigger(eventName, model, text);
              _super.trigger(eventName+':'+att, model, text);
            }
          });
          _super._nestedModels.push(att);
        }
      }
    }

  }, {
    // class methods

    attrPath: function(attrStrOrPath){
      var path;
      
      if (_.isString(attrStrOrPath)){
        // TODO this parsing can probably be more efficient
        path = (attrStrOrPath === '') ? [''] : attrStrOrPath.match(/[^\.\[\]]+/g);
        path = _.map(path, function(val){
          // convert array accessors to numbers
          return val.match(/^\d+$/) ? parseInt(val, 10) : val;
        });
      } else {
        path = attrStrOrPath;
      }

      return path;
    },

    createAttrObj: function(attrStrOrPath, val){
      var attrPath = this.attrPath(attrStrOrPath),
        newVal;

      switch (attrPath.length){
        case 0:
          throw new Error("no valid attributes: '" + attrStrOrPath + "'");
        
        case 1: // leaf
          newVal = val;
          break;
        
        default: // nested attributes
          var otherAttrs = _.rest(attrPath);
          newVal = this.createAttrObj(otherAttrs, val);
          break;
      }

      var childAttr = attrPath[0],
        result = _.isNumber(childAttr) ? [] : {};
      
      result[childAttr] = newVal;
      return result;
    },

    createAttrStr: function(attrPath){
      var attrStr = attrPath[0];
      _.each(_.rest(attrPath), function(attr){
        attrStr += _.isNumber(attr) ? ('[' + attr + ']') : ('.' + attr);
      });

      return attrStr;
    },

    deepClone: function(obj){
      return $.extend(true, {}, obj);
    }

  });

})();
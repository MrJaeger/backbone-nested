# Backbone-Nested-Models
A plugin that builds on both [Backbone.js](http://documentcloud.github.com/backbone) and [Backbone-Nested.js](https://github.com/afeld/backbone-nested) to be able to handle the nesting of Backbone.js Models.

## Compatability with Backbone-Nested.js
There is only one aspect of Backbone-Nested not duplicated in Backbone-Nested-Model.  Wheras before it was acceptable to do `model.get('attribute').nestedAttribute`, when working with Backbone-Nested-Model you must instead do `model.get('attribute.nestedAttribute)`.  Other than that everything is the same!  If you want to know everything that Backbone-Nested can do I suggest checking out the [Backbone-Nested github page](https://github.com/afeld/backbone-nested)

##Nested Models

So imagine you have two models: Person and Car

Person
```javascript
var Person = Backbone.Nested.Model({
  url: '/person'
});
```

Car
```javascript
var Car = Backbone.Nested.Model({
  url: '/car'
});
```

We will then make a new person, who will eventually become the driver of our car.

```javascript
var awesome_driver = new Person({
  name: 'Andrew Jaeger'
  , age: 21
  , sobriety: true
  , lNum: 1000
});
```

And finally we can make our car with our newly created person as the driver!

```javascript
var car = new Car({
  make: 'Volvo'
  , model: 'S60'
  , year: 2002
  , driver: awesome_driver
});
```
And then we can do everything we would expect to be able to do using Backbone-Nested.
```javascript
car.get('driver') //returns the driver model
car.get('driver.name') //returns 'Andrew Jaeger'
car.set('driver.age', 20) //drivers age will be set to 20
car.set({'driver.sobriety': false}) //we now have ourselves a drunk driver!
```

## Bubbling up events
Say we need to take some action if our driver gets drunk (hopefully make him stop driving!).  We can easily make this happen by setting a change event on the driver's sobriety, as all Nested Models bubble up events to their parent model.

So now we can easily make our driver stop driving if he gets drunk!
```javascript
car.bind('change:driver.sobriety', function(eventName, model, text) {
  if(model.get('sobriety') === false)
    car.stopDriving();
}
});
```

##Nested updating
The save, fetch, and destroy functions are now all implemented to be recursive.  Thus if our car is saved, the driver will be saved as well.  This would be nice to maybe make optional, but for my purposes it is what I wanted.

##ChangeLog

V1.0.0
Woot first version!

## Contributing

Pull requests are more than welcome - please add tests, which can be run by opening test/index.html.
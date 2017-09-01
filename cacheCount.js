import _ from 'lodash'
import migrate from './autoMigrate.js'

Mongo.Collection.prototype.cacheCount = function(options) {
	check(options, {
		collection:Mongo.Collection,
		cacheField:String,
		referenceField:String,
		selector:Match.Optional(Object),
		validate:Match.Optional(Boolean)
	})

	let parentCollection = !options.validate && Package['aldeed:collection2'] ? this._collection : this
	let childCollection = options.collection
	let selector = options.selector || {}
	let cacheField = options.cacheField
	let referenceField = options.referenceField
	let watchedFields = _.union([referenceField], _.keys(selector))

	function update(child){
		let ref = _.get(child, referenceField)
		if(ref){
			let select = _.merge(selector, {[referenceField]:ref})
			parentCollection.update({_id:ref}, {$set:{[cacheField]:childCollection.find(select).count()}})
		}
	}

	function insert(userId, parent){
		let select = _.merge(selector, {[referenceField]:parent._id})
		parentCollection.update(parent._id, {$set:{[cacheField]:childCollection.find(select).count()}})
	}

	migrate(parentCollection, insert, options)

	parentCollection.after.insert(insert)
	
	childCollection.after.insert((userId, child) => {
		update(child)
	})

	childCollection.after.update((userId, child, changedFields) => {
		if(_.intersection(changedFields, watchedFields).length){
			update(child)
			update(this.previous)
		}
	})

	childCollection.after.remove((userId, child) => {
		update(child)
	})
}
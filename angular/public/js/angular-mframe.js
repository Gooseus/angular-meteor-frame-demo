angular.module('ngMFrame', [])
// Start of the service, needs to be FAR more comprehensive
.factory('mUtil', [
	function() {
		return {
			inColl: function(coll,key,val) {
				var len = coll.length;
				for(var i=0;i<len;i++) {
					if(coll[i][key]==val) {
						return i;
					}
				}
				return -1;
			}
		}
	}
])
// TODO more abstraction, especially of the interface... require service to be configured a la $routeProvider
.service('$meteor', [
	'$rootScope', 'mUtil',
	function($rootScope, mUtil) {
		var svc = {
			models: {},
			queue: [],
			queueRpc: function(fn,args) {
				var rpc = {
						fn: fn,
						args: args
					};
				
				svc.queue.push(rpc);
			},
			setChannelSubscription: function(channel, params) {
				svc.queueRpc('subscribe', [ channel, params ]);
			},
			getModel: function(name) {
				return this.models[name];
			},
			createModel: function(name,interfaces) {
				var mdl = {
					collection: []
				},
				interfaces = interfaces || Object.keys(svc.interfaces);
				
				interfaces.forEach(function(name) {
					mdl[name] = svc.interfaces[name](mdl.collection);
				});

				svc.models[name] = mdl;

				return mdl;
			},
			// Routes data from the meteor instance to the bound scope method
			router: function(scope) {
				return function(e) {
					var msg = e.data;

					console.log('message from meteor', msg);
					// If we have a collection, its a model opertation
					// this should be more functional still
					if(msg.coll) {
						var model = scope[msg.coll];
						scope.$apply(function() {
							model[msg.op](msg.data);
						});
					} else {
						// if no collection, lets just broadcast the operation
						console.log('meteor event broadcasted', msg.op);
						$rootScope.$apply(function() {
							$rootScope.$broadcast('meteor::'+msg.op, msg.data);	
						});
					}
					// console.log('message from server', msg);
				}
			},
			interfaces: {
				// leave and follow pattern of filter?
				added: function(coll) {
					return function(doc) {
						var idx = mUtil.inColl(coll,'_id',doc._id);
						
						if(idx===-1) {
							coll.push(doc);
						}
					};
				},
				removed: function(coll) {
					return function(doc) {
						var idx = mUtil.inColl(coll,'_id',doc._id);
						
						if(idx!==-1) {
							coll.splice(idx,1);
						}
					};
				},
				changed: function(coll) {
					return function(doc) {
						var idx = mUtil.inColl(this.collection,'_id',doc._id);
						
						if(idx!==-1) {
							angular.extend(this.collection[idx], doc);
						}
					};
				}
			}
		};

		return svc;
	}
])
// Start of the directive, this should probably be an Element directive and create the iframe on the fly
.directive('mframe', [
	'$meteor',
	function($meteor) {
		return {
			scope: {},
			link: function($scope,$el,$attrs) {
				// console.log('whats on our iframe?', $el);
				$el.css('display','none');

				// Wait for meteor to startup
				$scope.$on('meteor::startup', function() {
					// Then start watching the $meteor queue
					$scope.$watch(function() {
						return $meteor.queue.length;
					}, function(qlen) {
						console.log('current queue', qlen, $meteor.queue);
						if(qlen) {
							var msgs = $meteor.queue.splice(0,qlen);

							msgs.forEach(function(msg) {
								$el[0].contentWindow.postMessage(msg,'*');
							});
						}
					});
				});
			}
		}
	}
]);
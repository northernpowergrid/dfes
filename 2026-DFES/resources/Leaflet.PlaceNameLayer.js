/* 
	Leaflet library to create tile-based label layers
*/
(function (factory, window) {
	if (typeof define === 'function' && define.amd) define(['leaflet'], factory); // define an AMD module that relies on 'leaflet'
	else if (typeof exports === 'object') module.exports = factory(require('leaflet')); // define a Common JS module that relies on 'leaflet'
	// attach your plugin to the global 'L' variable
	if (typeof window !== 'undefined' && window.L) window.LabelLayer = factory(L);
}(function (L) {
	var version = '0.2';
	var title = 'PlaceNameLayer';
	var prefix = 'label';
	var cls = 'leaflet-place-name-layer';

	var styles = document.createElement('style');
	styles.innerHTML = '.'+cls+'-marker > * {transform:translate3d(-50%,-50%,0);position:absolute;line-height:1em;}';
	document.head.prepend(styles);

	// Version 1.2
	function Logger(title){
		this.title = title||"OI Logger";
		this.logging = (location.search.indexOf('debug=true') >= 0);
		this.log = function(){
			var a,ext;
			if(this.logging || arguments[0]=="ERROR" || arguments[0]=="WARNING"){
				a = Array.prototype.slice.call(arguments, 0);
				// Build basic result
				ext = ['%c'+this.title+(version ? ' '+version:'')+'%c: '+a[1],'font-weight:bold;',''];
				// If there are extra parameters passed we add them
				if(a.length > 2) ext = ext.concat(a.splice(2));
				if(console && typeof console.log==="function"){
					if(arguments[0] == "ERROR") console.error.apply(null,ext);
					else if(arguments[0] == "WARNING") console.warn.apply(null,ext);
					else if(arguments[0] == "INFO") console.info.apply(null,ext);
					else console.log.apply(null,ext);
				}
			}
			return this;
		};
		return this;
	}
	var logger = new Logger(title);

	function uid(){
		return (prefix ? prefix+'-' : '')+Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	function collision(RectA, RectB){
		for(var i = 0; i < RectA.length; i++){
			if(RectA[i].right >= RectB.left && RectA[i].left <= RectB.right && RectA[i].top <= RectB.bottom && RectA[i].bottom >= RectB.top){
				return true;
			}
		}
		return false;
	}
	function getTileUrls(map,url,options) {
		var bounds,zoom,z,bestzoom,min,max,i,j,coords,urls;

		bounds = map.getBounds();
		zoom = map.getZoom();
		for(z = 0; z < options.zooms.length; z++){
			if(options.zooms[z] <= zoom-1){
				// The best zoom level is one level higher to reduce number of tiles needed
				bestzoom = options.zooms[z];
			}
		}
		if(typeof bestzoom==="undefined") return [];

		// Limit latitude/longitude range
		latlim = 89.99;
		lonlim = 179.99;
		if(bounds._northEast.lat > latlim) bounds._northEast.lat = latlim;
		if(bounds._southWest.lat < -latlim) bounds._southWest.lat = -latlim;
		if(bounds._northEast.lng > lonlim) bounds._northEast.lng = lonlim;
		if(bounds._southWest.lng < -lonlim) bounds._southWest.lng = -lonlim;

		min = map.project(bounds.getNorthWest(), bestzoom).divideBy(256).floor();
		max = map.project(bounds.getSouthEast(), bestzoom).divideBy(256).floor();
		urls = [];

		for(i = min.x; i <= max.x; i++) {
			for(j = min.y; j <= max.y; j++) {
				coords = new L.Point(i, j);
				coords.z = bestzoom;
				if(coords.x >= 0 && coords.y >= 0) urls.push(url.replace(/\{x\}/g,coords.x).replace(/\{y\}/g,coords.y).replace(/\{z\}/g,coords.z));
			}
		}
		return urls;
	}

	L.LayerGroup.PlaceNameLayer = L.LayerGroup.extend({
		_originalLayers: [],
		_visibleLayers: [],
		_staticLayers: [],
		_cache: {},
		options: {
			'sort': function(a,b){
				// If b is a capital and a isn't, sort by that
				if(typeof a.options.capital==="number" && typeof a.options.pop==="number") return (b.options.capital - a.options.capital) || a.options.pop < b.options.pop;
				return a.id > b.id;
			},
			'maxLabels': 30,
			'markerShow': function(zoom,options){
				if(zoom < 3) return false;
				if(zoom < 5 && options.pop < 300) return false;
				if(zoom >= 5 && zoom < 8 && options.pop < 200) return false;
				return true;
			},
			'styleMarker': function(zoom,options){
				var sty = {'color':(zoom < 9 ? '#dfdfdf':'white')};
				if(options.code=="PPLA"){
					sty.fontSize = (zoom >= 8 ? "1em" : "0.9em");
				}else if(options.code=="PPLA2"){
					sty.fontSize = (zoom >= 8 ? "0.9em" : "0.75em");
				}else if(options.code=="PPLA3" || options.code=="PPL"){
					sty.fontSize = (zoom >= 8 ? "0.75em" : "0.6em");
					sty.color = '#dfdfdf';
				}else if(options.code=="PPLC"){
					sty.textTransform = "uppercase";
					sty.color = "white";
				}else{
					sty.fontSize = "0.6em";
					sty.color = "#ccc";
				}
				return sty;
			},
			'styleLayer': function(zoom){
				if(zoom < 4) return {fontSize:"0.6em"};
				if(zoom < 5) return { fontSize:"0.7em"};
				if(zoom < 6) return { fontSize:"0.8em"};
				if(zoom < 7) return { fontSize:"0.9em"};
				return {};
			}
		},
		initialize: function(url,options) {
			logger.log('INFO','Initialise');
			if(!options) options = {};
			L.LayerGroup.prototype.initialize.call(this, options);
			L.Util.setOptions(this, options);
			if(!url){
				logger.log('ERROR','No url provided to LabelLayer');
				return this;
			}
			logger.log('INFO','options',options);
			if(typeof options.prefix==="string") prefix = options.prefix;
			if(typeof options.class==="string") cls = options.class;

			this._url = url;
		},
		_updateZoom: function(){
			this._zoom = this._map.getZoom();
			var pane = this._map.getPane('markerPane');
			this._updateMarkers();
			var sty,p;
			if(pane){
				pane.setAttribute('data-zoom',this._zoom);
				if(typeof this.options.styleLayer==="function"){
					sty = this.options.styleLayer.call(this,this._zoom)||{};
					if(this._prevsty){
						for(p in this._prevsty){
							if(typeof sty[p]==="undefined"){
								pane.style[p] = null;
							}
						}
					}
					for(p in sty) pane.style[p] = sty[p];
					this._prevsty = sty;
				}
			}
		},
		_initEvents: function () {
			this._map.on('zoomend zoomlevelschange', this._updateZoom, this);
			this._map.on('moveend', this._updatePosition, this);
		},
		addLayer: function(layer) {
			if(!('_icon' in layer)) {
				this._staticLayers.push(layer);
				L.LayerGroup.prototype.addLayer.call(this, layer);
				return;
			}
			//this._originalLayers.push(layer);
			if (this._map) {
				L.LayerGroup.prototype.addLayer.call(this, layer);
			}
		},
		onAdd: function(map){
			logger.log('INFO','Add to map');
			this._map = map;
			this._db = {};
			
			this._zoom = map.getZoom();

			if(this.options.attribution) map.attributionControl.addAttribution(this.options.attribution);

			map.on('viewreset', this._updatePosition, this);
			map.whenReady(this._initEvents, this).whenReady(this._updateZoom, this);
			this._updatePosition();
		},
		_makeMark: function(id,ll,label,options){
			if(!(id in this._db)){
				this._db[id] = {'pos':ll,'label':label,'options':options,'id':id};
				this._db[id].mark = L.marker(ll, {
					icon: L.divIcon({
						iconSize: "auto",
						className: (cls ? cls+'-':'')+'marker'+' '+(cls ? cls+'-':'')+options.code,
						html: '<span style="pointer-events: none;">' + (label||"") + '</span>'
					})
				}).on('mousedown',function(e){ e.originalEvent.preventDefault(); e.originalEvent.stopPropagation(); });
			}
		},
		_updateMarkers: function(){
			logger.log('INFO','UpdateMarkers');

			// Get an ordered list of markers
			var arr = this._orderedDB();

			// Get the map bounds + 10%
			this._bounds = this._map.getBounds().pad(0.05);

			var id,i,added,n,bbox,p,ok;
			for(i = 0; i < arr.length; i++){
				id = arr[i].id;
				if(this._db[id].added) this.removeLayer(arr[i].mark);
				this._db[id].added = false;
			}
			added = [];
			n = 0;
			p = (this.options.padding||0);
			for(i = 0; i < arr.length; i++){
				id = arr[i].id;
				ok = true;
				// Check if the marker is to be shown
				if(typeof this.options.markerShow==="function") ok = this.options.markerShow.call(this,this._zoom,this._db[id].options);
				
				// Is it ok and it is within the bounds + margin
				if(ok){
					if(this._bounds.contains(this._db[id].pos)){

						// Add the mark
						this.addLayer(this._db[id].mark);

						// Calculate the bounding box
						bbox = this._db[id].mark._icon.querySelector('span').getBoundingClientRect();
						this._db[id].bbox = {'left':bbox.left-p,'top':bbox.top-p,'right':bbox.right+p,'bottom':bbox.bottom+p,'name':this._db[id].label};

						// Check if we already have an overlapping label
						if(collision(added,this._db[id].bbox)){
							this.removeLayer(this._db[id].mark);
						}else{
							this._db[id].added = true;
							n++;
							added.push(this._db[id].bbox);
						}
					}
				}
				if(typeof this.options.maxLabels==="number" && n >= this.options.maxLabels) break;
			}
			logger.log('INFO','Added '+n+' labels.');
			if(typeof this.options.styleMarker==="function"){
				for(id in this._db) this._updateMarker(id);
			}
		},
		_updateMarker: function(id){
			var p,sty;
      if(id in this._db && this._db[id].added){
				sty = this.options.styleMarker.call(this,this._zoom,this._db[id].options)||{};
				if(this._db[id].prevsty){
					for(p in this._db[id].prevsty){
						if(typeof sty[p]==="undefined"){
							this._db[id].mark._icon.style[p] = null;
						}
					}
				}
				for(p in sty){
					this._db[id].mark._icon.style[p] = sty[p];
				}
				this._db[id].prevsty = sty;
			}
		},
		_addLabel: function(ll,label,options){
			if(!options) options = {};
			var id = options.id||uid();
			this._makeMark(id,ll,label,options);
		},
		listDB: function(){
			return this._db;
		},
		_orderedDB: function(){
			// Build an array
			var arr = [];
      var id,v;
			for(id in this._db){
				v = this._db[id];
				if(!v.id) v.id = id;
				arr.push(v);
			}
			if(typeof this.options.sort==="function") arr = arr.sort(this.options.sort);
			return arr;
		},
		_loadFiles: function(urls){
			var tiles = getTileUrls(this._map,this._url,this.options);
			var toload = tiles.length;
			var loaded = 0;
			for(var t = 0; t < tiles.length; t++){
				this._loadFile(tiles[t],function(url){
					loaded++;
					if(loaded==toload) this._updateMarkers();
				});
			}			
		},
		_loadFile: function(url,cb){
			if(!this._cache[url]){
				this._cache[url] = {'loading':true};

				fetch(url,{'method':'GET'})
				.then(function(response){ return response.text(); })
				.then(function(d){
					var rows = d.split(/[\n\r]+/);
					var r,head,cols,c;
					for(r = 0; r < rows.length; r++){
						cols = rows[r].split(/\t/);
						if(r == 0) head = cols;
						else {
							rows[r] = {};
							for(c = 0; c < cols.length; c++){
								rows[r][head[c]] = (head[c]=="lat" || head[c]=="lon" || head[c]=="pop" || head[c]=="capital" ? parseFloat(cols[c]) : cols[c]);
							}
							if(rows[r].lat && rows[r].lon) this._addLabel(new L.LatLng(rows[r].lat,rows[r].lon),rows[r].name,rows[r]);
						}
					}
					this._cache[url].loaded = true;
					delete this._cache[url].loading;

					if(typeof cb==="function") cb.call(this,url);
					else this._updateMarkers();

				}.bind(this)).catch(function(error){
					logger.log('WARNING','Unable to load data from '+url);
				});
			}else{
				if(typeof cb==="function") cb.call(this,url);
				else this._updateMarkers();
			}
		},
		_updatePosition: function() {
			logger.log('INFO','updatePosition');
			this._loadFiles(getTileUrls(this._map,this._url,this.options));
		},
		onRemove: function(map) {
			// Remove itself from Leaflet's overlay pane
			//map.getPanes().overlayPane.removeChild(this._layerElement);
			// Stop listening for viewreset events
			map.off('viewreset', this._updatePosition, this);

			if(this.options.attribution) map.attributionControl.removeAttribution(this.options.attribution);
		}

	});

	L.LayerGroup.placeNameLayer = function(url,options) {
		return new L.LayerGroup.PlaceNameLayer(url,options);
	};

}, window));

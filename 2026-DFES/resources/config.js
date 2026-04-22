// Define a new instance of the FES
var dfes = {};

if(!OI) var OI = {};
if(!OI.ready){
	OI.ready = function(fn){
		// Version 1.1
		if(document.readyState != 'loading') fn();
		else document.addEventListener('DOMContentLoaded', fn);
	};
}

OI.ready(function(){

	dfes = new FES({
		"options": {
			"scenario": "NPg Reference Scenario",
			"view": "lad_view",
			"key": "2024/25",
			"parameter": "ev",
			"scale": "relative",
			"years": {
				"columns":["2024/25","2025/26","2026/27","2027/28","2028/29","2029/30","2030/31","2031/32","2032/33","2033/34","2034/35","2035/36","2036/37","2037/38","2038/39","2039/40","2040/41","2041/42","2042/43","2043/44","2044/45","2045/46","2046/47","2047/48","2048/49","2049/50","2050/51"]
			},
			"files": {
				"parameters": "data/parameters.json",
				"scenarios": "data/scenarios.json"
			},
			"map": {
				"bounds": [[52.6497,-5.5151],[56.01680,2.35107]],
				"attribution": "Vis: <a href=\"https://open-innovations.org/projects/\">Open Innovations</a>, Data: NPG/Element Energy"
			}
		},
		"layers": {
			"PRIMARYlayer":{
				"geojson":"data/maps/npg-primaries-polygons-unique-2023_BGC.geojson",
				"key": "PRIMARYNM",
				"name": "PRIMARYNM"
			},
			"LADlayer":{
				"geojson": "data/maps/LAD2023-npg.geojson",
				"key": "LAD23CD",
				"name": "LAD23NM"
			}
			
		},
		"views":{
			"lad_view":{
				"title":"Local Authorities",
				"geography": "LAD",
				"layers":[{
					"id": "LADlayer",
					"heatmap": true,
					"boundary":{"strokeWidth":2}
				}],
				"popup": {
					"text": function(attr){
						var popup,title,dp,value;
						popup = '<h3>%TITLE%</h3><p>%VALUE%</p><svg id="barchart" class="oi-chart-main barchart" data-type="bar-chart" version="1.1" overflow="visible" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin meet"></svg><p style="font-size:0.8em;margin-top: 0;margin-bottom:0;text-align:center;">Primary substations (ordered)</p><p style="font-size:0.8em;margin-top:0.5em;">Columns show totals for each Primary substation associated with %TITLE%. The coloured portions show the fraction considered to be in %TITLE%. Hover over each to see details.</p>';
						title = (attr.properties[attr.name]||'?');
						dp = (typeof attr.parameter.dp==="number" ? attr.parameter.dp : 2);
						if(typeof attr.value!=="number") this.log('WARNING','No numeric value for '+attr.id)
						value = '<strong>'+attr.parameter.title+' '+this.options.key+':</strong> '+(typeof attr.value==="number" ? (dp==0 ? Math.round(attr.value) : attr.value.toFixed(dp)).toLocaleString()+''+(attr.parameter.units ? '&thinsp;'+attr.parameter.units : '') : '');
						return popup.replace(/\%VALUE\%/g,value).replace(/\%TITLE\%/g,title); // Replace values
					},
					"open": function(attr){
						if(!attr) attr = {};

						l = this.views[this.options.view].layers[0].id;
						key = this.layers[l].key;

						if(attr.id && key){

							let scenario = this.options.scenario;
							let parameter = this.options.parameter;
							let view = this.options.view;
							let geography = this.views[view].geography;
							let year = this.options.key;

							let d = this.scenarios[scenario].data[parameter][geography];
							let mapping = this.mapping[d.mapping].map;

							// We need to process the original primary data
							let raw = this.scenarios[scenario].data[parameter][d.use].raw;

							let data = [];
							let balloons = [];
							let str;
							let units = this.parameters[this.options.parameter].units;
							let dp = this.parameters[this.options.parameter].dp;

							// Work out the Local Authority name
							let LAD = attr.id;
							let name = LAD;
							if(this.layers.LADlayer) name = this.layers.LADlayer.geojson.features.find(f => { return (f.properties.LAD23CD==LAD); }).properties.LAD23NM;

							// Find the column for the year
							let yy = raw.header.findIndex(e => { return (e==year); });
							if(yy < 0) return;

							// Loop over the rows of the raw data (by primary)
							for(let r = 0; r < raw.rows.length; r++){
								let primary = raw.rows[r][0];
								if(primary in mapping && LAD in mapping[primary]){
									v = raw.rows[r][yy]||0;
									fracLA = mapping[primary][LAD] * v;
									fracOther = v - fracLA;
									str = '<h4>'+primary+'</h4><p>Total: '+(parseFloat(v.toFixed(dp))).toLocaleString()+' '+units+'<br />'+(mapping[primary][LAD]*100).toFixed(2).replace(/\.?0+$/,"")+'% is in '+name+'</p>';
									data.push({'value':v,'name':primary,'tooltip':str,'fract':mapping[primary][LAD]});
								}
							}

							// Sort by value
							data.sort(function(a, b) {
								if(a.value===b.value) return (a.name < b.name);
								else return (a.value < b.value) ? -1 : 1;
							}).reverse();

							let yaxis = defaultSpacing(0,data[0].value,2);
							let svg = attr.el.querySelector('.barchart');
							let sty = getComputedStyle(svg);
							let w = parseInt(sty.width);
							let h = parseInt(sty.height);
							let fw = 0.9;
							svg.setAttribute('viewBox','0 0 '+w+' '+h);
							let dx = (fw*w/data.length);
							let g,y;
							str = '';
							g = '<g class="axis-grid axis-grid-y">';
							for(let i = yaxis.min; i < yaxis.max; i += yaxis.spacing){
								y = (h*(1 - i/yaxis.max));
								g += '<path d="M0 '+(y-1).toFixed(2)+'h'+(w)+'" stroke="#999" stroke-width="0.5" />';
								g += '<text x="'+w+'" y="'+(y-2)+'" text-anchor="end" dominant-baseline="auto" stroke-width="0" fill="#999" font-weight="normal">'+(parseFloat(i.toFixed(dp))).toLocaleString()+'</text>';
							}
							g += '</g>';
							str += g;
							str += '<g class="data-layer" role="table">';
							for(let i = 0; i < data.length; i++){
								let tall = (h*data[i].value/yaxis.max);
								let no = tall-(tall*data[i].fract);
								g = '<g data="bar-'+i+'" role="row" x="'+(i*dx)+'" y="0">';
								g += '<rect class="no-bar" x="'+(i*dx).toFixed(2)+'" y="0" width="'+dx.toFixed(2)+'" height="'+h.toFixed(2)+'" fill="transparent"></rect>';
								g += '<rect class="bar" x="'+(i*dx).toFixed(2)+'" y="'+(h-tall+(tall==0 ? -1:0)).toFixed(2)+'" width="'+dx.toFixed(2)+'" height="'+Math.max(1,tall).toFixed(2)+'" fill="'+this.scenarios[scenario].color+'"><title>'+data[i].tooltip+'</title></rect>';
								g += '<rect class="anti-bar" x="'+(i*dx).toFixed(2)+'" y="'+(h-tall).toFixed(2)+'" width="'+dx.toFixed(2)+'" height="'+no.toFixed(2)+'" fill="rgb(204, 204, 204)"></rect>';
								g += '</g>';
								str += g;
							}
							str += '</g>';
							svg.innerHTML = str;

							// Add the tooltips
							let bars = svg.querySelectorAll('.bar');
							for(let i = 0; i < bars.length; i++){
								let g = bars[i].closest('g');
								let tt = OI.Tooltips.add(bars[i],{});
								addEv('mouseover',g.querySelector('.anti-bar'),{'tooltip':tt},function(e){ e.data.tooltip.show(); });
								addEv('mouseover',g.querySelector('.no-bar'),{'tooltip':tt},function(e){ e.data.tooltip.show(); });
							}

						}else{
							document.getElementById('barchart').remove();
						}
					}
				}
			},
			"primary_view":{
				"title":"Primary Substations",
				"geography": "primary",
				"layers":[{
					"id": "PRIMARYlayer",
					"heatmap": true,
				}],
				"popup": {
					"text": function(attr){
						var popup,title,dp,value;
						popup = '<h3>%TITLE%</h3><p>%VALUE%</p>';
						title = (attr.properties[attr.name]||'?');
						dp = (typeof attr.parameter.dp==="number" ? attr.parameter.dp : 2);
						if(typeof attr.value!=="number") this.log('WARNING','No numeric value for '+attr.id)
						value = '<strong>'+attr.parameter.title+' '+this.options.key+':</strong> '+(typeof attr.value==="number" ? (dp==0 ? Math.round(attr.value) : attr.value.toFixed(dp)).toLocaleString()+''+(attr.parameter.units ? '&thinsp;'+attr.parameter.units : '') : '?');
						return popup.replace(/\%VALUE\%/g,value).replace(/\%TITLE\%/g,title); // Replace values
					}
				}
			},
			"primary_lad_view":{
				"title":"Primary Substations (with Local Authorities)",
				"geography": "primary",
				"layers":[{
					"id":"LADlayer",
					"heatmap": false,
					"boundary":{"color":"#444444","strokeWidth":1,"opacity":0.5,"fillOpacity":0}
				},{
					"id":"PRIMARYlayer",
					"heatmap": true,
				}],
				"popup": {
					"text": function(attr){
						var popup,title,dp,value;
						popup = '<h3>%TITLE%</h3><p>%VALUE%</p>';
						title = (attr.properties[attr.name]||'?');
						dp = (typeof attr.parameter.dp==="number" ? attr.parameter.dp : 2);
						if(typeof attr.value!=="number") this.log('WARNING','No numeric value for '+attr.id)
						value = '<strong>'+attr.parameter.title+' '+this.options.key+':</strong> '+(typeof attr.value==="number" ? (dp==0 ? Math.round(attr.value) : attr.value.toFixed(dp)).toLocaleString()+''+(attr.parameter.units ? '&thinsp;'+attr.parameter.units : '') : '?');
						return popup.replace(/\%VALUE\%/g,value).replace(/\%TITLE\%/g,title); // Replace values
					}
				}
			}
		},
		"on": {
			"processData": function(data,d,url){
				if(url.match("https://northernpowergrid.opendatasoft.com/api/explore/v2.1/")){
					var rows = d.replace(/[\n\r]+$/,'').split(/\r\n/);
					var r,cols,c,head = {},header = [],orows = new Array(rows.length-1);
					if(rows.length > 1){
						for(r = 0; r < rows.length; r++){
							cols = rows[r].split(/\;/);
							if(r==0){
								header = [data.key];
								for(c = 0; c < cols.length; c++){
									head[cols[c]] = c;
									if(cols[c]==parseInt(cols[c])) header.push(parseInt(cols[c]));
								}
							}else{
								orows[r-1] = new Array(header.length);
								for(c = 0; c < header.length; c++){
									id = header[c];
									if(id==data.key){
										v = cols[head[id]].toUpperCase();
									}else{
										v = cols[head[id]];
										if(parseFloat(v)==v) v = parseFloat(v);
									}
									orows[r-1][c] = v;
								}
							}
						}
					}else{
						this.message('No data loaded from API',{'id':'error','type':'ERROR'});
					}
					// We need to add a "raw" variable that consists of { header: [], rows: [] }
					data.raw = {'rows':orows,'header':header};
					data.col = 0;
				}
				return data;
			},
			"setScenario": function(){
				if(OI.log) OI.log.add('action=click&content='+this.options.scenario);
			},
			"setParameter": function(){
				if(OI.log) OI.log.add('action=click&content='+this.parameters[this.options.parameter].title);
			},
			"setScale": function(t){
				var abs = document.querySelectorAll("[data-scale='absolute']");
				var rel = document.querySelectorAll("[data-scale='relative']");
				if(abs.length > 0) abs.forEach(function(e){ e.style.display = (t=="absolute") ? '' : 'none'; });
				if(rel.length > 0) rel.forEach(function(e){ e.style.display = (t=="relative") ? '' : 'none'; });
				return this;
			},
			"buildMap": function(){
				var el,div,_obj;
				el = document.querySelector('.leaflet-top.leaflet-left');
				if(el){
					// Does the place search exist?
					if(!el.querySelector('.placesearch')){
						
						_obj = this;

						div = document.createElement('div');
						div.classList.add('leaflet-control','leaflet-bar');
						div.innerHTML = '<div class="placesearch leaflet-button"><button class="submit" href="#" title="Search" role="button" aria-label="Search"></button><form class="placeform layersearch pop-left" action="search" method="GET" autocomplete="off"><input class="place" id="search" name="place" value="" placeholder="Search for a named area" aria-label="Search for a named area" type="text" /><div class="searchresults" id="searchresults"></div></div></form></div>';
						el.appendChild(div);
						
						if("geolocation" in navigator){
							div2 = document.createElement('div');
							div2.classList.add('leaflet-control','leaflet-bar');
							div2.innerHTML = '<div class="geolocate leaflet-button"><button id="geolocate" role="button" title="Centre map on my location" aria-label="Centre map on my location"></button></div>';
							el.appendChild(div2);
							addEv('click',div2,{},function(e){
								var btn = e.currentTarget;
								btn.classList.add('searching');
								navigator.geolocation.getCurrentPosition(function(position){
									_obj.map.panTo({lat: position.coords.latitude, lng: position.coords.longitude});
									btn.classList.remove('searching');
								},function(error){
									_obj.log('ERROR','Sorry, no position available.',`ERROR(${error.code}): ${error.message}`);
								},{
									enableHighAccuracy: true, 
									maximumAge        : 2000, 
									timeout           : 10000
								});
							});
						}

						function toggleActive(state){
							e = el.querySelector('.placesearch');
							if(typeof state!=="boolean") state = !e.classList.contains('typing');
							if(state){
								e.classList.add('typing');
								e.querySelector('input.place').focus();
							}else{
								e.classList.remove('typing');
							}
						}
					
						div.querySelector('.submit').addEventListener('click', function(e){ toggleActive(); });

						// Stop map dragging on the element
						el.addEventListener('mousedown', function(){ _obj.map.dragging.disable(); });
						el.addEventListener('mouseup', function(){ _obj.map.dragging.enable(); });

						// Define a function for scoring how well a string matches
						function getScore(str1,str2,v1,v2,v3){
							var r = 0;
							str1 = str1.toUpperCase();
							str2 = str2.toUpperCase();
							if(str1.indexOf(str2)==0) r += (v1||3);
							if(str1.indexOf(str2)>0) r += (v2||1);
							if(str1==str2) r += (v3||4);
							return r;
						}
						this.search = TypeAhead.init('#search',{
							'items': [],
							'render': function(d){
								// Construct the label shown in the drop down list
								return d['name']+(d['type'] ? ' ('+d['type']+')':'');
							},
							'rank': function(d,str){
								// Calculate the weight to add to this airport
								var r = 0;
								if(postcodes[postcode] && postcodes[postcode].data){
									_obj.log(d,d.id,postcodes[postcode].data.attributes.lep1);
									if(d.layer=="PRIMARYlayer"){
										if(d.id == matchedprimary){
											r += 10;
										}
									}else{
										for(var cd in postcodes[postcode].data.attributes){
											if(postcodes[postcode].data.attributes[cd]==d.id){
												r += 1;
											}
										}
									}
								}
								if(d['name']) r += getScore(d['name'],str);
								if(d['id']) r += getScore(d['name'],str);
								return r;
							},
							'process': function(d){
								// Format the result
								var l,ly,key,i;
								l = d['layer'];
								ly = _obj.layers[l].layer;
								key = _obj.layers[l].key;
								for(i in ly._layers){
									if(ly._layers[i].feature.properties[key]==d['id']){

										// Zoom to feature
										_obj.map.fitBounds(ly._layers[i]._bounds,{'padding':[5,5]});

										// Open the popup for this feature
										ly.getLayer(i).openPopup();
										
										// Change active state
										toggleActive(false);
									}
								}
							}
						});
						var postcode = "";
						var postcodes = {};
						var regex = new RegExp(/^([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([AZa-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z]))))[0-9][A-Za-z]{2})$/);
						var matchedprimary = "";
						this.search.on('change',{'me':this.search},function(e){
							var v = e.target.value.replace(/ /g,"");
							var m = v.match(regex)||[];
							if(m.length){
								_obj.log('INFO','Looks like a postcode',m[0]);
								postcode = m[0];
								if(!postcodes[m[0]]){
									postcodes[m[0]] = {};
									AJAX('https://findthatpostcode.uk/postcodes/'+m[0]+'.json',{
										'dataType':'json',
										'postcode':m[0],
										'this': e.data.me,
										'success': function(data,attr){
											postcodes[attr.postcode] = data;
											matchedprimary = findPrimary(_obj,data);
											this.update();
										}
									});
								}else{
									if(postcodes[m[0]].data) matchedprimary = findPrimary(_obj,postcodes[m[0]]);
								}
							}else postcode = "";
						});
					}
					function findPrimary(_obj,data){
						var matched,j,l,i,geojson;
						// Loop through layers
						for(j = 0; j < _obj.views[_obj.options.view].layers.length; j++){
							l = _obj.views[_obj.options.view].layers[j].id;
							// If the layer is PRIMARYlayer we see if we can match a polygon
							if(l=="PRIMARYlayer"){
								geojson = L.geoJSON(_obj.layers[l].geojson);
								matched = leafletPip.pointInLayer([data.data.attributes.long,data.data.attributes.lat],geojson);
								if(matched.length==1) return matched[0].feature.properties[_obj.layers[l].name];
							}
						}
						return "";
					}
					if(this.search){
						var l,f,i,j,name,code;
						this.search._added = {};
						this.search.clearItems();
						for(j = 0; j < this.views[this.options.view].layers.length; j++){
							l = this.views[this.options.view].layers[j].id;
							name = this.layers[l].name;
							code = this.layers[l].key;
							if(this.layers[l].geojson && this.layers[l].geojson.features && code && name){
								// If we haven't already processed this layer we do so now
								if(!this.search._added[l]){
									f = this.layers[l].geojson.features;
									for(i = 0; i < f.length; i++) this.search.addItems({'name':f[i].properties[name]||"?",'id':f[i].properties[code]||"",'i':i,'layer':l});
									this.search._added[l] = true;
								}
							}
						}
					}
				}
			}
		}
	});



	// Add download button
	if(document.getElementById('download-csv')){
		addEv('click',document.getElementById('download-csv'),{me:dfes},function(e){
			e.preventDefault();
			e.stopPropagation();
			let csv = "";
			let opt = e.data.me.options;
			// Update geography key
			opt.geography = e.data.me.views[opt.view].geography;
			let filename = ("DFES-2025--{{scenario}}--{{parameter}}--{{geography}}.csv").replace(/\{\{([^\}]+)\}\}/g,function(m,p1){ return (opt[p1]||"").replace(/[ ]/g,"_") });
			let values,r,rs,y,v,l,layerid,p,ky,nm;
			let data = e.data.me.scenarios[e.data.me.options.scenario].data[e.data.me.options.parameter][e.data.me.views[e.data.me.options.view].geography];
			csv += data.raw.header.join(",")+"\n";
			// Find the area column
			let col = data.raw.header.indexOf((data.use ? "Area" : data.key));
			// Make rows
			for(r = 0; r < data.raw.rows.length; r++){
				csv += (data.raw.header[col].match(",") ? '"' : '') + data.raw.rows[r][col] + (data.raw.header[col].match(",") ? '"' : '');
				for(c = 0; c < data.raw.rows[r].length; c++){
					if(c!=col && e.data.me.options.years.columns.indexOf(data.raw.header[c])>=0){
						csv += ",";
						csv += (typeof e.data.me.parameters[e.data.me.options.parameter].dp==="number" ? data.raw.rows[r][c].toFixed(e.data.me.parameters[e.data.me.options.parameter].dp) : data.raw.rows[r][c]);
					}
				}
				csv += "\n";
			}
			saveToFile(csv,filename,'text/plain');
		});
	}
	function saveToFile(txt,fileNameToSaveAs,mime){
		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;

		var textFileAsBlob = new Blob([txt], {type:(mime||'text/plain')});

		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var dl = document.createElement("a");
		dl.download = fileNameToSaveAs;
		dl.innerHTML = "Download File";

		if(window.webkitURL != null){
			// Chrome allows the link to be clicked without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();
	}
	function getGeoJSONPropertiesByKeyValue(geojson,key,value){
		if(!geojson.features || typeof geojson.features!=="object"){
			fes.log('WARNING','Invalid GeoJSON',geojson);
			return {};
		}
		for(var i = 0; i < geojson.features.length; i++){
			if(geojson.features[i].properties[key] == value) return geojson.features[i].properties;
		}
		return {};
	};
	function getGeoJSONPropertyValue(l,value){
		if(!fes.layers[l].key){
			fes.log('WARNING','No key set for layer '+l);
			return "";
		}
		if(fes.layers[l] && fes.layers[l].geojson){
			key = (fes.layers[l].name||fes.layers[l].key);
			for(var i = 0; i < fes.layers[l].geojson.features.length; i++){
				if(fes.layers[l].geojson.features[i].properties[fes.layers[l].key] == value) return fes.layers[l].geojson.features[i].properties[key];
			}
			return "";
		}else return "";
	};

});


function saveDOMImage(el,opt){
	if(!opt) opt = {};
	if(!opt.src) opt.src = "map.png";
	if(opt.scale){
		if(!opt.height) opt.height = el.offsetHeight*2;
		if(!opt.width) opt.width = el.offsetWidth*2;
		// Force bigger size for element
		w = el.style.getPropertyValue('width');
		h = el.style.getPropertyValue('height');
		el.style.setProperty('width',(opt.width)+'px');
		el.style.setProperty('height',(opt.height)+'px');
	}
	el.classList.add('capture');
	domtoimage.toPng(el,opt).then(function(dataUrl){
		var link = document.createElement('a');
		link.download = opt.src;
		link.href = dataUrl;
		link.click();
		// Reset element
		if(opt.scale){
			el.style.setProperty('width',w);
			el.style.setProperty('height',h);
		}
		el.classList.remove('capture');
	});
}
function defaultSpacing(mn,mx,n){

	var dv,log10_dv,base,frac,options,distance,imin,tmin,i;

	// Start off by finding the exact spacing
	dv = (mx-mn)/(n);

	// In any given order of magnitude interval, we allow the spacing to be
	// 1, 2, 5, or 10 (since all divide 10 evenly). We start off by finding the
	// log of the spacing value, then splitting this into the integer and
	// fractional part (note that for negative values, we consider the base to
	// be the next value 'down' where down is more negative, so -3.6 would be
	// split into -4 and 0.4).
	log10_dv = Math.log10(dv);
	base = Math.floor(log10_dv);
	frac = log10_dv - base;

	// We now want to check whether frac falls closest to 1, 2, 5, or 10 (in log
	// space). There are more efficient ways of doing this but this is just for clarity.
	options = [1,2,5,10];
	distance = new Array(options.length);
	imin = -1;
	tmin = 1e100;
	for(i = 0; i < options.length; i++){
		distance[i] = Math.abs(frac - Math.log10(options[i]));
		if(distance[i] < tmin){
			tmin = distance[i];
			imin = i;
		}
	}

	// Now determine the actual spacing
	return {
		'min':mn,
		'max':mx,
		'spacing':(Math.pow(10,base)) * (options[imin])
	};
}

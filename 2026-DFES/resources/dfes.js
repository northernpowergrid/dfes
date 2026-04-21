/*!
	Open Innovations Future Energy Scenario viewer
	Changeset:
	2.1.0
	- Explicitly define year columns e.g. to allow columns of the style "2024/25"
	2.0.0
	- Restructure scenarios file to be able to provide data for different geographies
	- Deprecate old parameters/scenarios structures
	- Move scenario CSS definition
	- Use <input type="range">
	1.6.0
	- Remove stuquery dependency
	- There is now a "processData" event so that we can reshape an API return
	1.5.8
	- Can set different map tiles/labels with on.initMap
	1.5.7
	- Send name key to popup
	1.5.6
	- Add error message when missing mapping
	1.5.5
	- Check if drop-downs already exist in DOM
	1.5.4
	- Bug fix for CSV columns with quotation marks
	1.5.3
	- Improve large pips to deal with not including 2020
	1.5.2
	- Allow values in files to be scaled on load
	- Fix minor pips on year slider
	- Add callback for setScale
	1.5.1
	- If the initial parameter key in the config is set to one that doesn't exist we need to fail nicely with an error message.
	1.5.0
	- scenario and parameter config is now in an array (rather than an object) to make sure order is preserved
 */
/*jshint esversion: 6 */ 
(function(root){

	let OI = root.OI || {};
	if(!OI.ready){
		OI.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}

	const scripts = document.getElementsByTagName('script');
	let basepath = "";
	for(let i = 0; i < scripts.length; i++){
		if(scripts[i].src.indexOf('dfes.js')>=0) basepath = scripts[i].src.split('?')[0];	// remove any ?query
	}
	basepath = basepath.split('/').slice(0, -2).join('/')+'/';  // remove last filename part of path

	// Main function
	function FES(config){

		this.version = "2.1.0";
		this.title = "FES";
		if(!config) config = {};
		this.options = (config.options||{});
		this.parameters = {};
		this.data = { };
		this.logging = (location.search.indexOf('debug=true') >= 0);
		this.log = function(){
			let a,ext;
			// Version 1.1.1
			if(this.logging || arguments[0]=="ERROR" || arguments[0]=="WARNING" || arguments[0]=="INFO"){
				a = Array.prototype.slice.call(arguments, 0);
				// Build basic result
				ext = ['%c'+this.title+' '+this.version+'%c: '+a[1],'font-weight:bold;',''];
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
		this.layers = (config.layers||{});
		this.views = (config.views||{});
		this.mapping = (config.mapping||{});
		this.events = {};
		if(config.on) this.events = config.on;
		if(!this.options.files) this.options.files = {};
		if(!this.options.files.parameters) this.options.files.parameters = basepath+"data/config.json";
		if(!this.options.files.scenarios) this.options.files.scenarios = basepath+"data/index.json";

		this.getDir = function(p){ return p.replace(/[^\/]*$/g,""); };
		this.getURL = function(url,file){
			if(!url.match(/^https/)) url = basepath + this.getDir(this.options.files.scenarios) + url;
			return url;
		};

		this.fetch(this.options.files.parameters,{
			'type':'json',
			'callback': function(d){
				this.parameters = {};
				// The parameters config is an array (to preserve order)
				// so we need to convert it into an object
				for(let i = 0; i < d.length; i++){
					if(d[i].key) this.parameters[d[i].key] = d[i];
				}
				this.fetch(this.options.files.scenarios,{
					'type':'json',
					'callback': function(d){
						this.scenarios = d;
						this.init();
					},
					'error':'Unable to load scenarios from '
				});
			},
			'error': 'Unable to load parameters from '
		});

		return this;
	}

	FES.prototype.init = function(){
		let html,s,i,j,l,p,css,g,gorder,groups;

		// Build some CSS classes for the scenarios
		var styles = document.createElement('style');
		for(let scenario in this.scenarios){
			// Build CSS class name
			if(!this.scenarios[scenario].css) this.scenarios[scenario].css = scenario.replace(/[^_a-zA-Z0-9-]/g,'-').toLowerCase();
			if(!("title" in this.scenarios[scenario])) this.scenarios[scenario].title = scenario;
			styles.innerHTML += '.'+this.scenarios[scenario].css+' { --bg: '+(this.scenarios[scenario].color||"#000")+'; --fg: '+(this.scenarios[scenario].fontColor||contrastColour(this.scenarios[scenario].color||"#000"))+'; background-color: var(--bg); color: var(--fg); accent-color: var(--bg); }\n';
			styles.innerHTML += '.'+this.scenarios[scenario].css+'-text { --fg: '+(this.scenarios[scenario].fontColor||contrastColour(this.scenarios[scenario].color||"#000"))+'; color: var(--fg); }\n';
		}
		document.head.prepend(styles);

		// Set the default colour scale
		if(this.options.scale=="absolute"){
			document.querySelector('#scale-holder input').setAttribute('checked','checked');
			document.getElementById('scale-holder').classList.add('checked');
		}

		// Update scenarios drop-down
		if(this.scenarios){
			if(!document.getElementById('scenarios')) document.getElementById('scenario-holder').innerHTML = '<select id="scenarios"></select>';
			html = "";
			for(s in this.scenarios){
				html += "<option"+(this.options.scenario == s ? " selected=\"selected\"":"")+" class=\""+(this.scenarios[s].css||"")+"\" value=\""+s+"\">"+s+"</option>";
			}
			document.getElementById('scenarios').innerHTML = html;
			addEv('change',document.getElementById('scenarios'),{'me':this},function(e){
				e.preventDefault();
				e.data.me.setScenario(e.currentTarget.value).setParameter(e.data.me.options.parameter).loadData();
			});
		}

		// Update views drop-down
		if(this.views){
			if(!document.getElementById('view')) document.getElementById('view-holder').innerHTML = '<select id="views">'+html+'</select>';
			html = "";
			
			gorder = [];
			groups = {};
			for(l in this.views){
				g = this.views[l].optgroup||"all";
				if(!groups[g]){
					groups[g] = [];
					gorder.push(g);
				}
				groups[g].push(l);
			}
			for(i = 0; i < gorder.length; i++){
				g = gorder[i];
				if(g != "all") html += '<optgroup label="'+g+'">';
				for(j = 0; j < groups[g].length; j++){
					l = groups[g][j];
					html += "<option"+(this.options.view == l ? " selected=\"selected\"":"")+" value=\""+l+"\">"+this.views[l].title+"</option>";
				}
				if(g != "all") html += '</optgroup>';
			}
			document.getElementById('views').innerHTML = html;
			addEv('change',document.getElementById('views'),{'me':this},function(e){
				e.preventDefault();
				e.data.me.setView(e.currentTarget.value).setParameter(e.data.me.options.parameter).loadData();
			});
		}

		// Update parameters drop-down
		if(this.parameters){
			if(!document.getElementById('parameters')) document.getElementById('parameter-holder').innerHTML = '<select id="parameters">'+html+'</select>';
			html = "";
			if(!this.scenarios[this.options.scenario]) this.message('Scenario <em>"'+this.options.scenario+'"</em> is not defined in index.json.',{'id':'scenario','type':'ERROR'});
			css = this.scenarios[this.options.scenario].css;
			gorder = [];
			groups = {};
			for(p in this.parameters){
				g = this.parameters[p].optgroup||"all";
				if(!groups[g]){
					groups[g] = [];
					gorder.push(g);
				}
				groups[g].push(p);
			}
			for(i = 0; i < gorder.length; i++){
				g = gorder[i];
				if(g != "all") html += '<optgroup label="'+g+'">';
				for(j = 0; j < groups[g].length; j++){
					p = groups[g][j];
					html += "<option"+(this.options.parameter == p ? " selected=\"selected\"":"")+" value=\""+p+"\">"+this.parameters[p].title+"</option>";
				}
				if(g != "all") html += '</optgroup>';
			}
			if(!this.parameters[this.options.parameter]){
				this.message('No parameter '+this.options.parameter+' exists. Sorry.',{'id':'parameter','type':'ERROR'});
			}
			document.getElementById('parameters').innerHTML = html;

			// Add about section after
			const about = document.createElement('div');
			about.setAttribute('class','about '+css);
			about.innerHTML = this.parameters[this.options.parameter] ? (this.parameters[this.options.parameter].description||'') : '';
			document.getElementById('parameter-holder').appendChild(about);
			addEv('change',document.getElementById('parameters'),{'me':this},function(e){
				e.preventDefault();
				e.data.me.setParameter(e.currentTarget.value).loadData();
			});
		}

		// Add events to colour scale switch
		addEv('change',document.querySelector('#scale-holder input'),{me:this},function(e){
			e.preventDefault();
			e.data.me.setScale(e.currentTarget.checked);
		});

		// Create the year slider
		let _obj = this;
		this.slider = document.getElementById('slider');
		let labels = document.createElement('div');
		labels.classList.add('pip-labels');
		const dy = 10;
		let y,year;
		if(typeof this.options.years.columns!=="object"){
			this.message('No explicit columns set for years in options so using min/max.',{'id':'error','type':'ERROR'});
			this.options.years.columns = [];
			for(year = this.options.years.min ; year <= this.options.years.max; year++){
				this.options.years.columns.push(year);
			}
		}
		for(y = 0; y < this.options.years.columns.length; y++){
			year = this.options.years.columns[y];
			let opt = document.createElement('option');
			opt.setAttribute('value',y);
			let lbl = document.createElement('span');
			let y2 = parseInt(year);
			if(y2%dy==0){
				lbl.innerHTML = this.options.years.columns[y];
				lbl.classList.add('big');
			}else{
				lbl.innerHTML = '';
			}
			lbl.setAttribute('data-y',this.options.years.columns[y]);
			lbl.style.left = (100*y/(this.options.years.columns.length-1))+"%";
			lbl.addEventListener('click',function(e){
				_obj.setYear(e.target.getAttribute('data-y'));
			});
			labels.appendChild(lbl);
		}
		this.slider.after(labels);
		this.slider.setAttribute('min',0);
		this.slider.setAttribute('max',this.options.years.columns.length-1);
		// Bind the changing function to the update event.
		this.slider.addEventListener('input',function(e){ _obj.setYear(_obj.options.years.columns[parseInt(e.target.value)]); });
		this.setYear(this.options.key);

		// Set the scenario
		this.setScenario(this.options.scenario).setParameter(this.options.parameter).setView(this.options.view).loadData();

		// Trigger the setScale callback (because we aren't explicity calling it)
		if(typeof this.events.setScale==="function") this.events.setScale.call(this,this.options.scale);

		// Add events to the play/pause buttons
		addEv('click',document.getElementById('play'),{me:this},function(e){
			e.preventDefault();
			e.stopPropagation();
			e.data.me.startAnimate();
		});
		addEv('click',document.getElementById('pause'),{me:this},function(e){
			e.preventDefault();
			e.stopPropagation();
			e.data.me.stopAnimate();
		});

		return this;
	};

	FES.prototype.clearMap = function(){
		
		let scenario = this.options.scenario;
		let parameter = this.options.parameter;
		let geography = this.views[this.options.view].geography;
		let year,y;

		// We should build an empty result
		if(!this.scenarios[scenario].data[parameter]) this.scenarios[scenario].data[parameter] = {};
		// Clear the geography
		this.scenarios[scenario].data[parameter][geography] = {'raw':{'header':[],'rows':[]},'values':{},'fullrange':{'min':0,'max':1},'years':this.options.years};
		// Set default year ranges
		for(y = 0; y < this.options.years.columns.length; y++){
			year = this.options.years.columns[y];
			this.scenarios[scenario].data[parameter][geography].fullrange[year] = {'min':0,'max':1};
		}
		this.mapData(function(){
			// Clear the fake data
			delete this.scenarios[scenario].data[parameter][geography];
		});
		return this;
		
	};

	FES.prototype.loadData = function(callback){
		let url,data;
		let scenario = this.options.scenario;
		let parameter = this.options.parameter;
		let geography = this.views[this.options.view].geography;

		if(!callback){
			callback = function(){
				this.mapData();
				this.updateSlider();
			};
		}

		this.log('INFO',"loadData "+scenario+", "+parameter+", "+geography);

		// Have we loaded the parameter/scenario?
		if(!this.scenarios[scenario] || !(parameter in this.scenarios[scenario].data)){
			this.message('No data for <span class="' + this.scenarios[scenario].css + ' tape">' + scenario + '</span> / <em>' + (this.parameters[parameter].optgroup ? this.parameters[parameter].optgroup + ": " : "") + this.parameters[parameter].title + '</em> / ' + this.views[this.options.view].title,{'id':'error','type':'ERROR'});
			this.clearMap();
		}else{
			if(!(geography in this.scenarios[scenario].data[parameter])){
				//
				let altviews = "";
				let alts = Object.keys(this.scenarios[scenario].data[parameter]);
				for(let alt in this.views){
					if(alts.indexOf(this.views[alt].geography) >= 0){
						altviews += (altviews ? " or " : "") + '<strong>' + this.views[alt].title + '</strong>';
					}
				}
				this.message('No <em>' + this.views[this.options.view].title + '</em> data for <span class="' + this.scenarios[scenario].css + ' tape">' + scenario + '</span> / <em>' + (this.parameters[parameter].optgroup ? this.parameters[parameter].optgroup + ": " : "") + this.parameters[parameter].title + '</em>.' + (altviews ? "<br/>Try viewing by: "+altviews : ""),{'id':'error','type':'ERROR'});
				this.clearMap();
			}else{
				data = this.scenarios[scenario].data[parameter][geography];
				if(data.raw || (data.use && data.use in this.scenarios[scenario].data[parameter] && "raw" in this.scenarios[scenario].data[parameter][data.use] && data.mapping in this.mapping)){
					// We've either got the raw data or we have it for the other geography
					if(typeof callback==="function") callback.call(this);
				}else{

					// We don't have the raw data for this scenario/parameter loaded
					if(!data.raw){
						// We will allow two formats for `data`:
						//   1. { "file": "path/to/data.csv", "key": "Primary" },
						//     where:
						//       - `file` is the CSV file to use for this scenario/parameter/geography
						//       - `key` is the column to use in the data
						//   2. { "use": "other-geography", "mapping": "path/to/mapping.json" },
						//     where:
						//       - `use` references another geography's data
						//       - `mapping` contains either the mapping as an object or a path to a mapping
						url = "";
						if(data.file){
							url = this.getURL(data.file,this.options.files.scenarios);	// The CSV file
						}else if(data.use && data.use in this.scenarios[scenario].data[parameter] && "file" in this.scenarios[scenario].data[parameter][data.use]){
							url = this.getURL(this.scenarios[scenario].data[parameter][data.use].file,this.options.files.scenarios);
						}

						if(url){
							this.startLoading();
							this.fetch(url,{
								'type':'text',
								'this': this,
								'callback': function(d){
									// Trigger any event callback
									if(typeof this.events.processData==="function") data = this.events.processData.call(this,data,d,url);
									// If we've run processData() then we should have a raw attribute
									if(!data.raw){
										// We need to process the CSV
										this.log('MSG','Falling back to processing CSV.');

										let raw = CSV2JSON(d,1);
										
										// Find the column number for the column containing the name
										// And convert year headings to integers
										let col = -1,n,c,r;
										for(c = 0; c < raw.header.length; c++){
											n = raw.header[c];
											if(this.options.years.columns.indexOf(raw.header[c])>=0){
												if(raw.header[c] == data.key) col = c;
												for(r = 0; r < raw.rows.length; r++){
													// Convert to numbers - if the number doesn't parse replace with zero
													raw.rows[r][c] = (parseFloat(raw.rows[r][c])||0);
													if(typeof this.parameters[parameter].scaleValuesBy==="number") raw.rows[r][c] *= this.parameters[parameter].scaleValuesBy;
												}
											}
										}
										if(data.use){
											this.scenarios[scenario].data[parameter][data.use].raw = raw;
											if(col >= 0) this.scenarios[scenario].data[parameter][data.use].col = col;
										}else{
											data.raw = raw;
											if(col >= 0) data.col = col;
										}
									}
									this.loadData(callback);
								}
							});
						}else{
							this.message('The structure of ' + geography + ' / <span class="' + this.scenarios[scenario].css + ' tape">' + scenario + '</span> / ' + (this.parameters[parameter].optgroup ? this.parameters[parameter].optgroup + ": " : "") + this.parameters[parameter].title + ' doesn\'t seem to contain `file` or `use`.',{'id':'error','type':'ERROR'});
						}
					}
					if(data.mapping && !this.mapping[data.mapping]){
						let url = this.getURL(data.mapping,this.options.files.scenarios);
						this.fetch(url,{
							'type':'json',
							'callback': function(d){
								// Create the empty structure if necessary
								if(!(data.mapping in this.mapping)) this.mapping[data.mapping] = {};
								// Keep the original
								this.mapping[data.mapping]._original = d;
								// Run any processing of the data
								if(typeof this.mapping[data.mapping].process==="function") d = this.mapping[data.mapping].process.call(this,d);
								// Set the mapping
								this.mapping[data.mapping].map = d;

								if(typeof callback==="function") callback.call(this);
								this.stopLoading();
							}
						});
					}else{
						if(typeof callback==="function") callback.call(this);
						this.stopLoading();
					}					
				}
			}
		}
	};

	FES.prototype.setScenarioColours = function(scenario){
		let css = this.scenarios[scenario].css;
		let classes = [];
		for(let id in this.scenarios) classes.push(this.scenarios[id].css);
		if(!document.querySelector('#scenario-holder .about')) appendHTML(document.getElementById('scenario-holder'),'<div class="about"></div>');
		let el = document.querySelector('#scenario-holder .about');
		el.classList.remove(...classes);
		el.classList.add(css); 
		el.innerHTML = (this.scenarios[scenario].description||'');
		el = document.querySelector('#parameter-holder .about');
		el.innerHTML = (this.parameters[this.options.parameter] ? (this.parameters[this.options.parameter].description||'') : '');
		el.classList.remove(...classes);
		el.classList.add(css);
		for(let s in this.scenarios){
			document.getElementById('scenarios').classList.remove(this.scenarios[s].css);
			document.querySelectorAll('.scenario').forEach((i)=>{ i.classList.remove(this.scenarios[s].css); });
		}
		document.getElementById('scenarios').classList.add(css);
		document.querySelectorAll('.scenario').forEach((i)=>{ i.classList.add(css); });
		document.querySelectorAll('.noUi-connect').forEach((i)=>{ i.classList.add(css); });
		return this;
	};

	FES.prototype.setScenario = function(scenario){
		this.log('MSG','setScenario');

		// Set the scenario
		this.options.scenario = scenario;

		// Clear messages
		this.message('',{'id':'warn','type':'WARNING'});
		this.message('',{'id':'error','type':'ERROR'});

		// Update the CSS class
		this.setScenarioColours(scenario);

		// Trigger any event callback
		if(typeof this.events.setScenario==="function") this.events.setScenario.call(this);

		return this;
	};

	FES.prototype.setParameter = function(parameter){
		this.log('MSG','setParameter',parameter);

		// Clear messages
		this.message('',{'id':'warn','type':'WARNING'});
		this.message('',{'id':'error','type':'ERROR'});

		this.options.parameter = parameter;

		if(this.parameters[parameter]){
			let scenario = this.options.scenario;
			let geography = this.views[this.options.view].geography;
			let params = document.querySelectorAll('#parameters option');
			for(let i = 0; i < params.length; i++){
				let p = params[i].getAttribute('value');
				if(scenario in this.scenarios && p in this.scenarios[scenario].data && geography in this.scenarios[scenario].data[p]){
					params[i].removeAttribute('disabled');
				}else{
					params[i].setAttribute('disabled','disabled');
				}
			}

			this.message('',{'id':'error','type':'ERROR'});
			document.querySelector('#parameter-holder .about').innerHTML = (this.parameters[parameter].description||'');
		}

		// Trigger any event callback
		if(typeof this.events.setParameter==="function") this.events.setParameter.call(this);

		return this;
	};

	FES.prototype.setView = function(v){
		this.log('MSG','setView');

		// Clear messages
		this.message('',{'id':'warn','type':'WARNING'});
		this.message('',{'id':'error','type':'ERROR'});

		if(this.views[v]){
			this.options.view = v;
		}else{
			this.message('The view '+v+' does not exist!',{'id':'error','type':'ERROR'});
		}
		return this;
	};

	FES.prototype.startAnimate = function(){
		this.log('MSG','Start animation');
		this.setYear(this.options.years.columns[0]);
		document.getElementById('play').disabled = true;
		document.getElementById('pause').disabled = false;
		let _obj = this;
		// If we are starting at the end, reset first
		if(parseInt(this.slider.value)==this.options.years.columns.length-1) this.slider.value = this.options.years.columns[0];
		this.options.years.interval = setInterval(function(){
			const y = parseInt(_obj.slider.value) + 1;
			const yy = _obj.options.years.columns[y];
			if(yy != _obj.options.years.columns[_obj.options.years.length-1]){
				_obj.slider.value = y;
				_obj.setYear(yy).loadData();
			}else _obj.stopAnimate();
		},500);
		return this;
	};

	FES.prototype.stopAnimate = function(){
		this.log('MSG','Stop animation');
		clearInterval(this.options.years.interval);
		document.getElementById('play').disabled = false;
		document.getElementById('pause').disabled = true;

		return this;
	};

	FES.prototype.updateSlider = function(){
		this.log('MSG','updateSlider');

		let min,max,y,k,range,years;
		range = clone(this.options.years);

		// Find possible years
		if(this.scenarios[this.options.scenario].data[this.options.parameter].raw){
			years = clone(this.scenarios[this.options.scenario].data[this.options.parameter].raw.header);

			// Remove first column
			years.shift();
			min = this.options.years.min;
			max = this.options.years.max;
			for(y = 0; y < years.length; y++){
				k = 100*(years[y]-min)/(max-min);
				if(k >= 0){
					range[Math.round(k)+'%'] = years[y];
				}
			}
		}
		// Update the slider range and position
		this.slider.setAttribute('min',0);
		this.slider.setAttribute('max',this.options.years.columns.length-1);
		this.slider.value = this.options.years.columns.indexOf(this.options.key);
		return this;
	};

	FES.prototype.setScale = function(checked){
		this.log('MSG','setScale',checked);
		this.options.scale = (checked ? "absolute":"relative");
		if(checked) document.getElementById('scale-holder').classList.add('checked');
		else document.getElementById('scale-holder').classList.remove('checked');
		this.mapData();
		if(typeof this.events.setScale==="function") this.events.setScale.call(this,this.options.scale);
		return this;
	};

	FES.prototype.setYear = function(year){
		this.log('MSG','setYear',year);
		let y = this.options.years.columns.indexOf(year);
		if(typeof y==="undefined") y = this.slider.value;
		else this.slider.value = y;
		if(this.map){
			this.options.key = this.options.years.columns[y];
			this.mapData();
		}
		document.querySelectorAll('.year').forEach((el)=>{ el.innerHTML = this.options.years.columns[y]; });
		return this;
	};

	FES.prototype.mapData = function(callback){
		this.log('MSG','mapData');

		let s,p,v,g,data,l,id,d,key,r,c,area_from,area_to,year;
		s = this.options.scenario;
		p = this.options.parameter;
		v = this.options.view;
		g = this.views[v].geography;
		data = this.scenarios[s].data[p][g];
		key = data.key;

		if(!data.raw){
			if(data.use && data.use in this.scenarios[s].data[p] && "raw" in this.scenarios[s].data[p][data.use]){
				this.log('INFO','Mapping data from '+data.use+' to '+g);

				// Need to create a new CSV object that converts from other geography
				let years = {};
				d = this.scenarios[s].data[p][data.use];

				// Find the column that contains the area ID
				let area_col = d.raw.header.indexOf(d.key);

				// An object to store the value (v), fractional split (f) original area (src; unused)
				let processing = {};

				if(area_col >= 0){
					for(c = 0 ; c < d.raw.header.length; c++){
						if(this.options.years.columns.indexOf(d.raw.header[c])>=0) years[d.raw.header[c]] = true;
					}

					// Loop over data rows
					for(r = 0; r < d.raw.rows.length; r++){
						// Get the area we are going from and make sure it is a string
						area_from = d.raw.rows[r][area_col]+"";

						// Check if we know about this area in the mapping
						if(area_from in this.mapping[data.mapping].map){
	
							for(c = 0 ; c < d.raw.rows[r].length; c++){
								// Only process the column if it is a year
								if(d.raw.header[c] in years){

									year = d.raw.header[c];

									// Set an empty value
									if(d.raw.rows[r][c]=="") d.raw.rows[r][c] = 0;
									if(typeof d.raw.rows[r][c]!=="number" || isNaN(d.raw.rows[r][c])){
										this.log('WARNING','Non-numeric value for '+area_from+' (row '+r+') year '+year+' ',d.raw.rows[r][c]);
									}else{
										// Loop over each destination area and store this contribution
										for(let area_to in this.mapping[data.mapping].map[area_from]){
											if(!(area_to in processing)) processing[area_to] = {};
											if(!(year in processing[area_to])) processing[area_to][year] = [];
											// Add contributions from each source area
											processing[area_to][year].push({'value':d.raw.rows[r][c],'fraction':this.mapping[data.mapping].map[area_from][area_to],'source':area_from});
										}
									}
								}
							}
						}else{
							this.log('WARNING','Unable to find '+area_from+' in the mapping file '+data.mapping);
						}
					}
				}else{
					this.message('Unable to find column <em>'+d.key+'</em> in the file <em>'+this.scenarios[s].data[p][data.use].file+'</em>',{'id':'error','type':'ERROR'});
				}

				// Get an ordered array of years
				years = Object.keys(years).sort();

				// Build the raw object
				data.raw = {
					"header":[data.key||"Area"],
					"rows":[]
				};

				// Add the year headers
				for(let y = 0; y < years.length; y++) data.raw.header.push(years[y]);

				// Make each new area
				for(area_to in processing){
					let row = [area_to];

					// For each year
					for(let y = 0; y < years.length; y++){
						year = years[y];

						// The value should start at zero
						let value = 0;
						let combine = this.parameters[p].combine||"sum";

						// Loop over the contributions
						for(c = 0; c < processing[area_to][year].length; c++){
							if(combine=="sum" || combine=="average"){
								value += processing[area_to][year][c].value * processing[area_to][year][c].fraction;
							}else if(combine=="max"){
								value = Math.max(value,processing[area_to][year][c].value);
							}
						}
						// If it is an average we divide by the number of values
						if(this.parameters[p].combine=="average"){
							value /= processing[area_to][year].length;
						}
						row.push(value);
					}
					data.raw.rows.push(row);
				}
			}else{
				this.log('WARNING','No raw data yet available for '+s+'/'+p+'');
			}
		}else{
			this.log('MSG','Already got the raw data');
		}

		// Check we have the raw data
		if(!data.raw){
			this.log('WARNING','No raw data yet available for '+s+'/'+p+'');
			if(typeof callback==="function") callback.call(this);
			return this;
		}

		// Need to create a "values" object split by area and year
		if(!data.values){
			this.log('MSG','Make values object for '+g,data.raw);
			data.values = {};
			data.fullrange = {};
			data.years = {};
			let years = {};

			// Get the column key
			key = (data.use && data.use in this.scenarios[s].data[p] ? 'Area' : data.key);
			this.log('MSG','Looking for column '+key+' in header',data.raw.header,data);
			let area_col = data.raw.header.indexOf(key);

			if(area_col >= 0){
				for(r = 0; r < data.raw.rows.length; r++){
					area_to = data.raw.rows[r][area_col];
					if(!(area_to in data.values)) data.values[area_to] = {};
					for(c = 0 ; c < data.raw.header.length; c++){
						// Check if it is a year-like column
						if(this.options.years.columns.indexOf(data.raw.header[c])>=0){
							year = data.raw.header[c];
							data.values[area_to][year] = data.raw.rows[r][c]||0;
							if(!(year in years)) years[year] = [];
							years[year].push(data.values[area_to][year]);
						}
					}
					// Now find min/max for this area
					let values = Object.values(data.values[area_to]);
					data.values[area_to].min = Math.min(...values);
					data.values[area_to].max = Math.max(...values);
					data.fullrange = getMinMax(data.fullrange,values);
				}
			}else{
				this.log('WARNING','The column '+data.key+' has not been found in the data.');
			}

			// Get ranges for each year
			for(let y = 0; y < this.options.years.columns.length; y++){
				year = this.options.years.columns[y];
				data.fullrange[year] = {
					'min': Math.min(...years[year]),
					'max': Math.max(...years[year])
				};
				if(data.fullrange[year].min == data.fullrange[year].max) data.fullrange[year].min = 0;
			}
			if(data.fullrange.min == data.fullrange.max) data.fullrange.min = 0;
		}

		id = "";
		// We need to loop over the view's layers
		for(l = 0; l < this.views[v].layers.length; l++){
			// If this is a heatmap layer we need mapping
			if(this.views[v].layers[l].heatmap) id = this.views[v].layers[l].id;
		}

		if(!id){
			this.log('ERROR','No heatmap defined for '+v);
			if(typeof callback==="function") callback.call(this);
			return this;
		}

		// Save the result
		this.scenarios[s].data[p][g] = data;

		// Update the map
		this.buildMap();
		
		if(typeof callback==="function") callback.call(this);

		return this;
	};

	FES.prototype.buildMap = function(){
		this.log('MSG','buildMap');

		let scenario = this.options.scenario;
		let parameter = this.options.parameter;
		let view = this.options.view;
		let geo = this.views[view].geography;

		let _obj,mapel,mapid,info,color,ncolor,l,_id,_l,lid,bounds;
		bounds = L.latLngBounds(L.latLng(56.01680,2.35107),L.latLng(52.6497,-5.5151));
		if(this.options.map && this.options.map.bounds){
			bounds = L.latLngBounds(L.latLng(this.options.map.bounds[0][0],this.options.map.bounds[0][1]),L.latLng(this.options.map.bounds[1][0],this.options.map.bounds[1][1]));
		}
		this._bounds = bounds;
		_obj = this;

		if(!this.map){
			mapel = document.getElementById('map');
			mapid = mapel.getAttribute('id');
			this.map = L.map(mapid,{'scrollWheelZoom':true}).fitBounds(bounds);
			this.map.on('popupopen',function(e){
				// Call any attached functions
				if(_obj.views[_obj.options.view].popup && _obj.views[_obj.options.view].popup.open){
					let l = -1;
					for(let i = 0; i < _obj.views[_obj.options.view].layers.length; i++){
						if(_obj.views[_obj.options.view].layers[i].heatmap) l = i;
					}
					if(l>=0) _obj.views[_obj.options.view].popup.open.call(_obj,{'el':e.popup._contentNode,'id':e.popup._source.feature.properties[_obj.layers[_obj.views[_obj.options.view].layers[l].id].key]});
				}
			});
			this.map.attributionControl._attributions = {};
			if(this.options.map && this.options.map.attribution) this.map.attributionControl.setPrefix('').addAttribution(this.options.map.attribution);

			if(typeof this.events.initMap==="function") this.events.initMap.call(this);
			else{
				// Create a map label pane so labels can sit above polygons
				this.map.createPane('labels');
				this.map.getPane('labels').style.zIndex = 650;
				this.map.getPane('labels').style.pointerEvents = 'none';

				L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
					attribution: '',
					pane: 'labels'
				}).addTo(this.map);

				// CartoDB map
				L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
					attribution: 'Tiles: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
					subdomains: 'abcd',
					maxZoom: 19
				}).addTo(this.map);
			}

			info = L.control({'position':'topright'});
			info.onAdd = function(map){
				this._div = L.DomUtil.create('div','scenario');
				this._div.innerHTML = '<div class="year padded">'+_obj.options.key+'</div>';
				return this._div;
			};
			info.addTo(this.map);
			this.setScenarioColours(scenario);

		}

		color = (this.scenarios[scenario].color||"#000000");
		ncolor = (this.scenarios[scenario].negativecolor||"#404040");

		if(!this.scenarios[scenario].data[parameter][geo].values){
			this.log('ERROR','Scenario '+scenario.replace(/<[^\>]*>/g,'')+' not loaded',this.scenarios[scenario].data[parameter]);
			return this;
		}

		let layer,_geojson,gotlayers,id;

		if(this.map){

			gotlayers = true;

			for(l = 0 ; l < this.views[view].layers.length; l++){

				layer = this.views[view].layers[l];

				if(typeof this.layers[layer.id].geojson==="string"){

					// Show the spinner
					this.startLoading();

					let url = basepath + this.layers[layer.id].geojson;

					this.fetch(url,{
						'type':'json',
						'data': {
							'layer': layer,
						},
						'this': this,
						'callback':function(d,data){
							this.layers[data.layer.id].geojson = d;
							this.loadData();
						},
						'error':'Unable to load GeoJSON '
					});

					return this;
				}
				if(!this.layers[layer.id].geojson) gotlayers = false;

			}

			if(!gotlayers){
				return this;
			}else{

				this.message('',{'id':'warn','type':'WARNING'});

				_geojson = [];

				let highlightFeature = function(e){
					e.target.setStyle({
						weight: 2,
						color: color,
						opacity: 1,
						stroke: true
					});
					if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
				};

				let resetHighlight = function(e){
					// Reset all the layer styles
					for(let l = 0; l < _geojson.length; l++) _geojson[l].resetStyle(e.target);
				};

				// Remove existing layers
				for(l in this.layers){
					if(this.layers[l].layer){
						this.layers[l].layer.remove();
						delete this.layers[l].layer;
					}
				}

				// Re-build the layers for this view
				for(l = 0; l < this.views[view].layers.length; l++){
					this.views[view].layers[l].geoattr = {
						"style": {
							"color": (this.views[view].layers[l].boundary ? this.views[view].layers[l].boundary.color||color : color),
							"opacity": (this.views[view].layers[l].boundary ? this.views[view].layers[l].boundary.opacity||1 : 1),
							"weight": (this.views[view].layers[l].boundary ? this.views[view].layers[l].boundary.strokeWidth||0.5 : 0.5),
							"fillOpacity": (this.views[view].layers[l].boundary ? this.views[view].layers[l].boundary.fillOpacity||0 : 0),
							"fillColor": (this.views[view].layers[l].boundary ? this.views[view].layers[l].boundary.fillColor||color : color)
						}
					};

					_id = this.views[view].layers[l].id;

					if(this.views[view].layers[l].heatmap){

						_l = l;
						this.views[view].layers[l].range = {'min':0,'max':1};
						lid = this.views[view].layers[l].id;

						if(this.options.scale == "absolute"){
							// Get the full range
							this.views[view].layers[l].range = this.scenarios[scenario].data[parameter][geo].fullrange;
						}else{
							// Get the year range
							this.views[view].layers[l].range = this.scenarios[scenario].data[parameter][geo].fullrange[this.options.key];
						}

						if(!this.views[view].layers[l].range){
							console.error('Bad range.',this.options.key,this.scenarios[scenario].data[parameter][geo].fullrange);
						}

						// Get a nicer range
						this.views[view].layers[l].range = niceRange(this.views[view].layers[l].range.min,this.views[view].layers[l].range.max);

						if(!this.views[view].layers[l].colour){
							this.views[view].layers[l].colour = new Colours();
						}

						// Add/update a continuous colour scale
						this.views[view].layers[l].colourscale = 'DFES-continuous';
						this.views[view].layers[l].colour.addScale(this.views[view].layers[l].colourscale,getRGBAstr(color,0.0)+' 0%, '+getRGBAstr(color,0.8)+' 100%');

						// If the colourscale for this parameter is diverging we change the scale
						if(this.parameters[parameter] && this.parameters[parameter].diverging){
							// Set a text label (not used anywhere yet)
							this.views[view].layers[l].colourscale = 'DFES-diverging';
							// Set the colour stops from ncolour (opacity 1) to white (opacity 0) to colour (opacity 1)
							this.views[view].layers[l].colour.addScale(this.views[view].layers[l].colourscale,getRGBAstr(ncolor,1)+' 0%, rgba(255,255,255,0) 50%, '+getRGBAstr(color,0.8)+' 100%');
							// Update the range to be the same amount either side of zero
							this.views[view].layers[l].range.max = Math.max(Math.abs(this.views[view].layers[l].range.min),Math.abs(this.views[view].layers[l].range.max));
							this.views[view].layers[l].range.min = -this.views[view].layers[l].range.max;
						}

						// If the map scale needs to be quantised we now quantise the colour scale
						if(typeof this.options.map.quantised==="number"){
							this.views[view].layers[l].colour.quantiseScale(this.views[view].layers[l].colourscale,this.options.map.quantised,'DFES-quantised');
							this.views[view].layers[l].colourscale = 'DFES-quantised';
						}

						// Update the scale bar
						document.getElementById('scale').innerHTML = this.makeScaleBar(this.views[view].layers[l].colour.getGradient( this.views[view].layers[l].colourscale ),{
							'min': this.views[view].layers[l].range.min,
							'max': this.views[view].layers[l].range.max,
							'color': color,
							'scale': this.views[view].layers[l].colour,
							'scaleid': this.views[view].layers[l].colourscale,
							'levels': (typeof this.options.map.quantised==="number" ? this.options.map.quantised : undefined)
						});

						// Define the GeoJSON attributes for this layer
						this.views[view].layers[l].geoattr.style = function(feature){
							let layer = _obj.views[_obj.options.view].layers[_l];
							let scenario = _obj.options.scenario;
							let parameter = _obj.options.parameter;
							let view = _obj.options.view;
							let geo = _obj.views[view].geography;
							let props = {
								"opacity": 0.1,
								"fillOpacity": 0.8,
								"color": (layer.boundary ? layer.boundary.color||color : color),
								"fillColor": (layer.boundary ? layer.boundary.fillColor||color : color)
							};
							if(layer.boundary && typeof layer.boundary.stroke==="boolean") props.stroke = layer.boundary.stroke;
							if(feature.geometry.type == "Polygon" || feature.geometry.type == "MultiPolygon"){
								let c,key,data;
								c = {'r':0,'g':0,'b':0,'alpha':0};
								key = _obj.layers[layer.id].key;
								if(parameter in _obj.scenarios[scenario].data && geo in _obj.scenarios[scenario].data[parameter]){
									data = _obj.scenarios[scenario].data[parameter][geo];
									if(feature.properties[key] && data.values[feature.properties[key]] && !isNaN(layer.range.min) && !isNaN(layer.range.max)){
										c = layer.colour.getColourFromScale(layer.colourscale, data.values[feature.properties[key]][_obj.options.key],layer.range.min,layer.range.max,true);
									}
								}
								props.fillColor = 'rgb('+c.r+','+c.g+','+c.b+')';
								props.weight = (layer.boundary ? layer.boundary.strokeWidth||1 : 1);
								props.opacity = 0.1;
								props.fillOpacity = c.alpha;
							}
							return props;
						};
						this.views[view].layers[l].geoattr.onEachFeature = function(feature,l){
							let attr = {'this':_obj,'layer':_l,'maxWidth': 'auto'};
							let w = 400;
							if(_obj.map._container.offsetWidth < w) w = _obj.map._container.offsetWidth*0.8;
							let evnt = {
								'mouseover':highlightFeature,
								'mouseout': resetHighlight,
							};
							if(_obj.views[_obj.options.view].popup){
								let popup = popuptext(feature,attr);
								if(popup) l.bindPopup('<div class="dfes-popup-content"><div class="dfes-popup-inner">'+popup+'</div></div>',{'maxWidth':w});
							}
							if(typeof _obj.events.click==="function"){
								evnt.click = function(e){
									if(_obj.views[_obj.options.view].geography in _obj.scenarios[_obj.options.scenario].data[_obj.options.parameter]){
										_obj.events.click.call(_obj,feature,attr);
									}
								};
							}
							l.on(evnt);
						};
					}

				}

				for(l = 0; l < this.views[view].layers.length; l++){

					id = this.views[view].layers[l].id;
					if(!this.layers[id].layer){
						this.layers[id].layer = L.geoJSON(this.layers[id].geojson,this.views[this.options.view].layers[l].geoattr);
					}
					_geojson.push(this.layers[id].layer);
					if(this.layers[id].layer) this.layers[id].layer.addTo(this.map);
					this.layers[id].layer.setStyle(this.views[view].layers[l].geoattr.style);
				}

				this.stopLoading();
			}
		}

		// Trigger any event callback
		if(typeof this.events.buildMap==="function") this.events.buildMap.call(this);

		return this;
	};

	FES.prototype.startLoading = function(){
		// Show the spinner
		document.querySelector('#map .spinner').style.display = '';
		return this;
	};

	FES.prototype.stopLoading = function(){
		// Hide the spinner
		document.querySelector('#map .spinner').style.display = 'none';
		return this;
	};

	FES.prototype.fetch = function(resource, options = {}) {
		let { timeout = 3000 } = options;
		let controller = new AbortController();
		let id = setTimeout(() => controller.abort(), timeout);
		this.log('INFO','Getting %c'+resource.replace(/\%/g,'\\%')+'%c','font-style:italic;','');
		fetch(resource,{
			...options,
			signal: controller.signal
		}).then(response=>{
			if(!response.ok) throw new Error('Network response was not OK');
			if(options.type=="json") return response.json();
			else return response.text();
		}).then(d=>{
			this.log('INFO','Got '+resource);
			if(typeof options.callback==="function") options.callback.call(options['this']||this,d,options.data||{});
		}).catch(e => {
			this.message((options.error ? options.error : 'Unable to load from ')+'<em>'+resource.replace(/\?.*/,"")+'</em>',{'id':'error','type':'ERROR'});
		});
		clearTimeout(id);
		return this;
	};

	function popuptext(feature,attr){
		// does this feature have a property named popupContent?
		let popup,me,key,v,lid;
		popup = '';
		me = attr['this'];

		lid = me.views[me.options.view].layers[attr.layer].id;
		if(!me.layers[lid].key || !feature.properties[me.layers[lid].key]){
			me.log('ERROR','No property '+me.layers[lid].key+' in ',feature.properties);
			return "";
		}
		key = feature.properties[me.layers[lid].key];
		v = null;
		let scenario = me.options.scenario;
		let parameter = me.options.parameter;
		let view = me.options.view;
		let geo = me.views[view].geography;
		if(me.scenarios[scenario].data[parameter][geo].values && me.scenarios[scenario].data[parameter][geo].values[key]){
			v = me.scenarios[scenario].data[parameter][geo].values[key][me.options.key];
		}
		if(typeof v!=="number"){
			//console.warn('No value for '+key+' '+me.options.scenario+' '+me.options.parameter);
		}
		if(me.views[view].popup && typeof v!=="undefined"){
			if(typeof me.views[view].popup.text==="string"){
				popup = me.views[view].popup.text;
			}else if(typeof me.views[view].popup.text==="function"){
				popup = me.views[view].popup.text.call(me,{
					'view':view,
					'id':key,
					'key': (me.layers[lid].key||""),
					'name': (me.layers[lid].name||""),
					'value': v,
					'properties':feature.properties,
					'scenario': me.scenarios[scenario],
					'parameter': me.parameters[parameter]||{}
				});
			}
		}
		return popup;
	}

	FES.prototype.message = function(msg,attr){
		if(!attr) attr = {};
		if(!attr.id) attr.id = 'default';
		if(!attr.type) attr.type = 'message';
		if(msg) this.log(attr.type,msg.replace(/<[^\>]*>/g,""));
		let css = "b4-bg";
		if(attr.type=="ERROR") css = "error";
		if(attr.type=="WARNING") css = "warning";

		let msgel = document.querySelector('.message');
		let el;
		if(msgel.length == 0){
			msgel = document.createElement('div');
			el = msgel.querySelector('#'+attr.id);
			document.getElementById('scenario').before(el);
			msgel.classList.add('message');
		}else{
			el = msgel.querySelector('#'+attr.id);
		}
		if(!msg){
			// Remove the specific message container
			if(el) el.remove();
		}else if(msg){
			// We make a specific message container
			if(!el) appendHTML(msgel,'<div id="'+attr.id+'"><div class="holder padded"></div></div>');
			el = msgel.querySelector('#'+attr.id);
			el.classList.add(css);
			el.querySelector('.holder').innerHTML = msg;
		}

		return this;
	};

	FES.prototype.formatValue = function(v,param){
		if(!param) param = this.options.parameter;
		if(this.parameters[param]){
			let units = this.parameters[param].units;
			let format;
			// Do we need to round it?
			if(typeof this.parameters[param].dp==="number") v = parseFloat(v.toFixed(this.parameters[param].dp));
			if(this.parameters[param].format){
				try {
					format = eval('('+this.parameters[param].format+')');
				}catch(e){ }
				return format.call(this,v,units);
			}else{
				return v.toLocaleString()+(units ? '&thinsp;'+units : '');
			}
		}
		return '?';
	};

	FES.prototype.makeScaleBar = function(grad,attr){
		let gap,i,v,c,str;
		if(!attr) attr = {};
		if(!attr.min) attr.min = 0;
		if(!attr.max) attr.max = 0;
		str = '<div class="bar" style="'+grad+';"><div class="bar-inner" style="border-color: '+attr.color+'"></div></div><div class="range" style="border-color: '+attr.color+'">';
		if(attr.levels){
			gap = (attr.max-attr.min)/attr.levels;
			for(i = 0; i <= attr.levels; i++){
				v = attr.min + i*gap;
				c = attr.scale.getColourFromScale(attr.scaleid, v, attr.min, attr.max);
				this.formatValue(v);
				str += '<span class="lvl'+(i==0 ? ' min' : (i==attr.levels ? ' max':''))+'" style="border-color: '+(i==0 ? attr.color : c)+';left:'+(100*i/attr.levels)+'%;">'+this.formatValue(v)+'</span>';
			}
		}else{
			str += '<span class="lvl min" style="border-color: '+attr.color+';left:0%;">'+this.formatValue(attr.min)+'</span>';
			str += '<span class="lvl max" style="border-color: '+attr.color+';left:100%;">'+this.formatValue(attr.max)+'</span>';
		}
		str += '</div>';
		return str;
	};

	// Useful functions

	/**
	 * CSVToArray parses any String of Data including '\r' '\n' characters,
	 * and returns an array with the rows of data.
	 * @param {String} CSV_string - the CSV string you need to parse
	 * @param {String} delimiter - the delimeter used to separate fields of data
	 * @returns {Array} rows - rows of CSV where first row are column headers
	 */
	function CSVToArray(CSV_string, delimiter){
		delimiter = (delimiter || ","); // user-supplied delimeter or default comma

		let pattern = new RegExp( // regular expression to parse the CSV values.
			( // Delimiters:
				"(\\" + delimiter + "|\\r?\\n|\\r|^)" +
				// Quoted fields.
				"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
				// Standard fields.
				"([^\"\\" + delimiter + "\\r\\n]*))"
			), "gi"
		);

		let rows = [[]];  // array to hold our data. First row is column headers.
		// array to hold our individual pattern matching groups:
		let matches = false; // false if we don't find any matches
		// Loop until we no longer find a regular expression match
		while (matches = pattern.exec(CSV_string)){
			let matched_delimiter = matches[1]; // Get the matched delimiter
			// Check if the delimiter has a length (and is not the start of string)
			// and if it matches field delimiter. If not, it is a row delimiter.
			if (matched_delimiter.length && matched_delimiter !== delimiter) {
				// Since this is a new row of data, add an empty row to the array.
				rows.push( [] );
			}
			let matched_value;
			// Once we have eliminated the delimiter, check to see
			// what kind of value was captured (quoted or unquoted):
			if (matches[2]) { // found quoted value. unescape any double quotes.
				matched_value = matches[2].replace(
					new RegExp( "\"\"", "g" ), "\""
				);
			} else { // found a non-quoted value
				matched_value = matches[3];
			}
			// Now that we have our value string, let's add
			// it to the data array.
			rows[rows.length - 1].push(matched_value);
		}
		return rows; // Return the parsed data Array
	}

	// Simple CSV to JSON parser v3.3
	function CSV2JSON(str){
		// Convert \r\n to \n, remove final newline, and split by newlines
		let lines = str.replace(/[\n\r]{2}/g,"\n").replace(/[\n\r]+$/g,"").split(/\n/);
		let header = [],cols,i,c,data = [],datum,v;
		for(i = 0; i < lines.length; i++){
			cols = lines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/);
			if(i==0){
				header = cols;
				for(c = 0; c < header.length; c++) header[c] = cols[c].replace(/(^\"|\"$)/g,"");
			}else{
				datum = [];
				for(c = 0; c < header.length; c++){
					v = cols[c].replace(/(^\"|\"$)/g,"");
					if(parseFloat(v)==v) v = parseFloat(v);
					if(v=="True" || v=="true") v = true;
					if(v=="False" || v=="false") v = false;
					datum.push(v);
				}
				data.push(datum);
			}
		}
		// Return the structured data
		return { 'header':header, 'rows': data };
	}

	function getMinMax(o,v){
		if(!("min" in o)) o.min = Infinity;
		if(!("max" in o)) o.max = -Infinity;
		if(typeof v==="number"){
			o.min = Math.min(o.min,v);
			o.max = Math.max(o.max,v);
		}else{
			o.min = Math.min(o.min,Math.min(...v));
			o.max = Math.max(o.max,Math.max(...v));
		}
		return o;
	}

	// Function to clone a hash otherwise we end up using the same one
	function clone(hash) {
		return JSON.parse(JSON.stringify(hash));
	}

	function h2d(h) {return parseInt(h,16);}
	function toLin(v){ v /= 255; if (v <= 0.03928){ return v/12.92; }else{ return Math.pow((v+0.055)/1.055,2.4); }}
	function rLum(rgb){ return 0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]); }
	function contrastRatio(a, b){ let L1 = rLum(a); let L2 = rLum(b); if(L1 < L2){ let temp = L2; L2 = L1; L1 = temp; } return (L1 + 0.05) / (L2 + 0.05); }
	function colour2RGB(c){
		var rgb = [],bits;
		if(c.indexOf('#')==0){
			rgb = [h2d(c.substring(1,3)),h2d(c.substring(3,5)),h2d(c.substring(5,7))];
		}else if(c.indexOf('rgb')==0){
			bits = c.match(/[0-9\.]+/g);
			if(bits.length == 4) this.alpha = parseFloat(bits[3]);
			rgb = [parseInt(bits[0]),parseInt(bits[1]),parseInt(bits[2])];
		}
		return rgb;
	}
	function contrastColour(c){ let rgb = colour2RGB(c); return (contrastRatio(rgb,[0, 0, 0]) > contrastRatio(rgb,[255, 255, 255]) ? "black" : "white"); }

	String.prototype.regexLastIndexOf = function(regex, startpos) {
		regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
		if(typeof (startpos) == "undefined") startpos = this.length;
		else if(startpos < 0)  startpos = 0;
		let stringToWorkWith = this.substring(0, startpos + 1);
		let lastIndexOf = -1;
		let nextStop = 0;
		let result;
		while((result = regex.exec(stringToWorkWith)) != null) {
			lastIndexOf = result.index;
			regex.lastIndex = ++nextStop;
		}
		return lastIndexOf;
	};

	function getRGBAstr(c,a){
        a = (typeof a==="number" ? a : 1.0);
        let rgb = "rgba(0,0,0,1)";
        if(c.indexOf("rgb")==0) rgb = c.replace(/^rgba?\(([0-9]+),([0-9]+),([0-9]+),?([0-9\.]+)?\)$/,function(m,p1,p2,p3,p4){ return "rgba("+p1+","+p2+","+p3+","+p4+")"; });
        else if(c.indexOf('#')==0) rgb = "rgba("+parseInt(c.substr(1,2),16)+","+parseInt(c.substr(3,2),16)+","+parseInt(c.substr(5,2),16)+","+a+")";
        return rgb;
    }

	function niceRange(mn,mx){

		let dv,log10_dv,base,frac,options,distance,imin,tmin,i,n;
		n = 20;

		// Start off by finding the exact spacing
		dv = (mx - mn)/n;

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
		let inc = Math.pow(10,base) * options[imin];

		return {'min': Math.floor(mn/inc) * inc, 'max': Math.ceil(mx/inc) * inc};
	}

	root.FES = function(config){ return new FES(config); };


	/* ============== */
	/* Colours v0.3.2 */
	// Define colour routines
	function Colour(c,n){
		if(!c) return {};
		function d2h(d) { return ((d < 16) ? "0" : "")+d.toString(16);}
		function h2d(h) {return parseInt(h,16);}
		/**
		 * Converts an RGB color value to HSV. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
		 * Assumes r, g, and b are contained in the set [0, 255] and
		 * returns h, s, and v in the set [0, 1].
		 *
		 * @param	Number  r		 The red color value
		 * @param	Number  g		 The green color value
		 * @param	Number  b		 The blue color value
		 * @return  Array			  The HSV representation
		 */
		function rgb2hsv(r, g, b){
			r = r/255;
			g = g/255;
			b = b/255;
			let max = Math.max(r, g, b), min = Math.min(r, g, b);
			let h, s, v = max, d = max - min;
			s = max == 0 ? 0 : d / max;
			if(max == min) h = 0; // achromatic
			else{
				switch(max){
					case r: h = (g - b) / d + (g < b ? 6 : 0); break;
					case g: h = (b - r) / d + 2; break;
					case b: h = (r - g) / d + 4; break;
				}
				h /= 6;
			}
			return [h, s, v];
		}

		this.alpha = 1;

		// Let's deal with a variety of input
		if(c.indexOf('#')==0){
			this.hex = c;
			this.rgb = [h2d(c.substring(1,3)),h2d(c.substring(3,5)),h2d(c.substring(5,7))];
		}else if(c.indexOf('rgb')==0){
			let bits = c.match(/[0-9\.]+/g);
			if(bits.length == 4) this.alpha = parseFloat(bits[3]);
			this.rgb = [parseInt(bits[0]),parseInt(bits[1]),parseInt(bits[2])];
			this.hex = "#"+d2h(this.rgb[0])+d2h(this.rgb[1])+d2h(this.rgb[2]);
		}else return {};
		this.hsv = rgb2hsv(this.rgb[0],this.rgb[1],this.rgb[2]);
		this.name = (n || "Name");
		let r,sat;
		for(r = 0, sat = 0; r < this.rgb.length ; r++){
			if(this.rgb[r] > 200) sat++;
		}
		this.toString = function(){
			return 'rgb'+(this.alpha < 1 ? 'a':'')+'('+this.rgb[0]+','+this.rgb[1]+','+this.rgb[2]+(this.alpha < 1 ? ','+this.alpha:'')+')';
		};
		this.text = (this.rgb[0]*0.299 + this.rgb[1]*0.587 + this.rgb[2]*0.114 > 186 ? "black":"white");
		return this;
	}
	function Colours(){
		let scales = {
			'Viridis': 'rgb(68,1,84) 0%, rgb(72,35,116) 10%, rgb(64,67,135) 20%, rgb(52,94,141) 30%, rgb(41,120,142) 40%, rgb(32,143,140) 50%, rgb(34,167,132) 60%, rgb(66,190,113) 70%, rgb(121,209,81) 80%, rgb(186,222,39) 90%, rgb(253,231,36) 100%'
		};
		function col(a){
			if(typeof a==="string") return new Colour(a);
			else return a;
		}
		this.getColourPercent = function(pc,a,b,inParts){
			pc /= 100;
			a = col(a);
			b = col(b);
			let c = {'r':parseInt(a.rgb[0] + (b.rgb[0]-a.rgb[0])*pc),'g':parseInt(a.rgb[1] + (b.rgb[1]-a.rgb[1])*pc),'b':parseInt(a.rgb[2] + (b.rgb[2]-a.rgb[2])*pc)};
			if(a.alpha<1 || b.alpha<1) c.alpha = ((b.alpha-a.alpha)*pc + a.alpha);
			if(inParts) return c;
			else return 'rgb'+(c.alpha && c.alpha<1 ? 'a':'')+'('+c.r+','+c.g+','+c.b+(c.alpha && c.alpha<1 ? ','+c.alpha:'')+')';
		};
		this.makeGradient = function(a,b){
			a = col(a);
			b = col(b);
			let grad = a.toString()+' 0%, '+b.toString()+' 100%';
			if(b) return 'background: '+a.toString()+'; background: -moz-linear-gradient(left, '+grad+');background: -webkit-linear-gradient(left, '+grad+');background: linear-gradient(to right, '+grad+');';
			else return 'background: '+a.toString()+';';
		};
		this.getGradient = function(id){
			return 'background: -moz-linear-gradient(left, '+scales[id].str+');background: -webkit-linear-gradient(left, '+scales[id].str+');background: linear-gradient(to right, '+scales[id].str+');';
		};
		this.addScale = function(id,str){
			scales[id] = str;
			processScale(id,str);
			return this;
		};
		this.quantiseScale = function(id,n,id2){
			let cs,m,pc,step,i;
			cs = [];
			m = n-1;
			pc = 0;
			step = 100/n;
			for(i = 0; i < m; i++){
				cs.push(this.getColourFromScale(id,i,0,m)+' '+(pc)+'%');
				cs.push(this.getColourFromScale(id,i,0,m)+' '+(pc+step)+'%');
				pc += step;
			}
			cs.push(this.getColourFromScale(id,1,0,1)+' '+(pc)+'%');
			cs.push(this.getColourFromScale(id,1,0,1)+' 100%');
			this.addScale(id2,cs.join(", "));
			return this;
		};
		function processScale(id,str){
			if(scales[id] && scales[id].str){
				console.warn('Colour scale '+id+' already exists. Bailing out.');
				return this;
			}
			scales[id] = {'str':str};
			scales[id].stops = extractColours(str);
			return this;
		}
		function extractColours(str){
			let stops,cs,i,c;
			stops = str.replace(/^\s+/g,"").replace(/\s+$/g,"").replace(/\s\s/g," ").split(', ');
			cs = [];
			for(i = 0; i < stops.length; i++){
				let bits = stops[i].split(/ /);
				if(bits.length==2) cs.push({'v':bits[1],'c':new Colour(bits[0])});
				else if(bits.length==1) cs.push({'c':new Colour(bits[0])});
			}

			for(c=0; c < cs.length;c++){
				if(cs[c].v){
					// If a colour-stop has a percentage value provided, 
					if(cs[c].v.indexOf('%')>=0) cs[c].aspercent = true;
					cs[c].v = parseFloat(cs[c].v);
				}
			}
			return cs;
		}

		// Process existing scales
		for(let id in scales){
			if(scales[id]) processScale(id,scales[id]);
		}

		// Return a Colour object for a string
		this.getColour = function(str){
			return new Colour(str);
		};
		// Return the colour scale string
		this.getColourScale = function(id){
			return scales[id].str;
		};
		// Return the colour string for this scale, value and min/max
		this.getColourFromScale = function(s,v,min,max,inParts){
			let cs,v2,pc,c,cfinal;
			if(typeof inParts!=="boolean") inParts = false;
			if(!scales[s]){
				this.log('WARNING','No colour scale '+s+' exists');
				return '';
			}
			if(typeof v!=="number") v = 0;
			if(typeof min!=="number") min = 0;
			if(typeof max!=="number") max = 1;
			cs = scales[s].stops;
			v2 = 100*(v-min)/(max-min);
			cfinal = {};
			if(v==max){
				cfinal = {'r':cs[cs.length-1].c.rgb[0],'g':cs[cs.length-1].c.rgb[1],'b':cs[cs.length-1].c.rgb[2],'alpha':cs[cs.length-1].c.alpha};
			}else{
				if(cs.length == 1){
					cfinal = {'r':cs[0].c.rgb[0],'g':cs[0].c.rgb[1],'b':cs[0].c.rgb[2],'alpha':(v2/100).toFixed(3)};
				}else{
					for(c = 0; c < cs.length-1; c++){
						if(v2 >= cs[c].v && v2 <= cs[c+1].v){
							// On this colour stop
							pc = 100*(v2 - cs[c].v)/(cs[c+1].v-cs[c].v);
							if(pc > 100) pc = 100;	// Don't go above colour range
							cfinal = this.getColourPercent(pc,cs[c].c,cs[c+1].c,true);
							continue;
						}
					}
				}
			}
			if(inParts) return cfinal;
			else return 'rgba(' + cfinal.r + ',' + cfinal.g + ',' + cfinal.b + ',' + cfinal.alpha + ")";
		};

		return this;
	}

})(window || this);

/* Global functions */
function setAttr(el,prop){
	for(let p in prop) el.setAttribute(p,prop[p]);
	return el;
}
function addEv(ev,el,data,fn){
	el.addEventListener(ev,function(e){
		e.data = data;
		fn.call(data.this||this,e);
	});
}
function appendHTML(el,html){
	if(html){
		const d = document.createElement('template');
		d.innerHTML = html;
		const c = (typeof d.content==="undefined" ? d : d.content);
		if(c.childNodes.length > 0) while(c.childNodes.length > 0) el.appendChild(c.childNodes[0]);
		else el.append(html);
	}
	return el;
}

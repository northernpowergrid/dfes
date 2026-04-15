> **WARNING**: The data in this directory is placeholder data and is not the final 2026 DFES data.

# Future Energy Scenario Data

Element Energy create yearly predictions for each Primary sub-station over a variety of `parameters` for several `scenarios`. The data are stored in separate files - one for each `scenario`/`parameter` combination - within the [scenarios/primaries/](scenarios/primaries/) sub-directory. 

## Files

The following files are in this directory:

* [colours.csv](colours.csv) - this is used to define the colours used for lines on the graphs.
* [graphs.pl](graphs.pl) - Perl code that generates the graphs and tables. It will need to be re-run if the graph data are updated.
* [primaries2lad.json](primaries2lad.json) - how Primary sub-stations split between Local Authority Districts. The split was calculated using the proportion of customers attached to a Primary were within different Local Authority Districts.
* [scenarios.json](scenarios.json) - JSON file describes the scenarios and gives links to the relevant data files for each parameter within each scenario.
* [parameters.json](parameters.json) - JSON file defining the parameters

## Adding a scenario

Open the [scenarios.json](scenarios.json) JSON file and make sure it contains the scenario. Each scenario is of the form:

```javascript
{
	"Steady Progression": {
		"description": "<ul><li>Achieves the 2050 decarbonisation target.</li><li>Decentralised pathway.</li></ul>",
		"color": "#901320",
		"negativecolor": "#d7191c",
		"data": {
			"ev": {
				"primary": { "file": "scenarios/primaries/EV-RS.csv", "key": "Primary" },
				"LAD": { "use": "primary", "mapping": "primaries2lad.json" }
			}
		}
	}
}
```

Where:
* `description` is HTML that appears below the scenario drop-down box
* `color` is a hex code to use for this scenario
* `negativecolor` is a contrasting colour to use for negative values (you could get inspiration from [ColorBrewer](https://colorbrewer2.org/#type=diverging&scheme=BrBG&n=3))
* `data` contains unique keys for each parameter which should match the keys used in [parameters.json](parameters.json). Each parameter should reference geographies (e.g. `primary`) and each of those can be of the form:

`{ "file": "scenarios/primaries/EV-RS.csv", "key": "Primary" }`

or 

`{ "use": "primary", "mapping": "primaries2lad.json" }`

where `file` is the CSV file containing the data, `key` is the column in the CSV file that references an area's name, `use` refers to another geography (that does have a CSV file) and `mapping` is the file to use to map geographies in `use` to the current geography.

Check the final JSON is valid using [JSON Lint](https://jsonlint.com/) otherwise you could break the visualisation if you have an invalid file.

## Adding a parameter

Parameters are defined in [parameters.json](parameters.json). This should consist of an array of parameters each with a unique `key` that is referenced in [scenarios.json](scenarios.json). Keys should be simple - they won't be displayed in the visualisation - and any special characters (e.g. `‘`, `”`, `\`) will need to be escaped with a `\`. For this example we will use `newparameter`


```javascript
{ "key": "newparameter", "title": "Our brand new parameter", "combine": "sum", "units":"", "dp": 0, "description": "The short description that appears below the drop down" }
```

where:
* `newparameter` is a _unique_ key for this property;
* `title` is the label that appears in the drop down list (e.g. `Electric Vehicles (number)`);
* `combine` determines how Primary Sub-station values are combined into Local Authorities (`sum` to add each Primary contribution up or `max` to find the maximum value of a Primary in the Local Authority);
* `units` is the label to put after a number on the scale and popups (e.g. `MWh`);
* `description` is the help text that appears below the drop down.

Check the final JSON is valid using [JSON Lint](https://jsonlint.com/) otherwise you could break the visualisation if you have an invalid file.


## Sub-directories

### [graphs/](graphs/)

The graphs directory contains CSV files used to generate the graphs for `graph.html`. The [index.json](graphs/index.json) file defines each of the graphs that will be made by running `perl graph.pl`. Each one is of the form:

```
{
	"csv":"Total number of EVs (#).csv",
	"svg":"graph-ev.svg",
	"table":"graph-ev.html",
	"yaxis-label": "Number",
	"yaxis-max": 100,
	"yscale": 100,
	"left": 120
}
```

where `csv` is the CSV file in the [graphs/](graphs/) directory to use, `svg` is the file name for the resulting SVG graphic, `table` is the resulting HTML fragment for the table, `yaxis-label` is the y-axis label, `left` is the left placement (in pixels) of the y-axis, `yaxis-max` is the maximum value for the y-axis (useful for limiting the auto-range), and `yscale` is a factor by which to scale the y-axis values (particularly useful for getting to percentages from 0-1 range numbers).

### [lib/](lib/)

This directory contains Perl modules for use by the `graphs.pl` code.

### [maps/](maps/)

The maps directory contains GeoJSON files that are needed for the visualisation. These include:

  * [LAD2023-npg.geojson](maps/LAD2023-npg.geojson) - the Local Authority boundaries (2023)
  * [npg-primaries-polygons-unique-2023_BGC.geojson](maps/npg-primaries-polygons-unique-2023_BGC.geojson) - the geography of the Primary sub-stations (based on 2023)

### [scenarios/](scenarios/)

The data for each scenario is stored in here.


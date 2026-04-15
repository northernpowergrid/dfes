# CSV files for graphs in DFES

## Defining graphs

The graphs are defined in [index.json](index.json). This consists of an ordered array of objects representing sections. Each section can have a `title`, and `intro` and `graphs`. Each `graphs` is an array of objects of the form:

```javascript
{
	"title": "Annual carbon emissions (MtCO2)",
	"csv":"AnnualCarbonEmissions_MtCO2.csv",
	"svg":"graph-annual-co2-emissions.svg",
	"yaxis-label": "Mt CO2(e)",
	"left": 50
}
```

where:
* `title` is the title for the graph
* `csv` is the relative path to the CSV file to use for this graph
* `svg` is the output filename for the generated SVG (should end with .svg)
* `yaxis-label` is the label to use for the y-axis
* `left` is a manual fudge factor to position the y-axis to deal with the fact the code can't easily calculate the lengths of the y-axis tick labels

The CSV file for the graph should have rows for each series. The first column should contain the name of each series and it should be followed by time-ordered year columns with numeric values similar to the format used in the main visualisation.

Once you commit a change to `index.json`, or any of the CSV files in this directory, the [updateGraphs.yml workflow](../../../.github/workflows/updateGraphs.yml) should run to re-generate the graphs.

# Geography

The geographies used in the visualisation. 

The [Local Authority Districts](https://geoportal.statistics.gov.uk/datasets/local-authority-districts-april-2019-boundaries-uk-buc) are taken from [the ONS geo service](https://ons-inspire.esriuk.com/arcgis/rest/services/Administrative_Boundaries/Local_Authority_Districts_April_2019_Boundaries_UK_BUC/MapServer/0/query?where=1%3D1&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=true&returnTrueCurves=false&maxAllowableOffset=&geometryPrecision=5&outSR=&having=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&historicMoment=&returnDistinctValues=false&resultOffset=&resultRecordCount=&queryByDistance=&returnExtentOnly=false&datumTransformation=&parameterValues=&rangeValues=&quantizationParameters=&featureEncoding=esriDefault&f=geojson). They are [released under OGL](https://www.ons.gov.uk/methodology/geography/licences):

* Contains National Statistics data © Crown copyright and database right 2019
* Contains OS data © Crown copyright and database right 2019


We have to convert from Output Area (2011) to Local Authority District (2019) using [data from the ONS](https://geoportal.statistics.gov.uk/datasets/postcode-to-output-area-to-lower-layer-super-output-area-to-middle-layer-super-output-area-to-local-authority-district-august-2019-lookup-in-the-uk).


## Adding supply points

To add supply points we took the decision to treat them as **pseudo-Primaries** with one per Local Authority area. These pseudo-Primaries will be added as extra rows to the CSV files and we will add their link to Local Authorities to the [mapping file](../primaries2lad.json). By using this method, the Local Authority view will then include the total value within that Local Authority (not just from Primaries) and the pop-up graphs will show the total non-Primary amount in that authority as one extra bar. 

We wanted to also show the pseudo-Primaries on the map as small "cut-outs" at the location of each one. Northern Powergrid supplied an XLS file with the OSGB X/Y coordinates for each supply point along with the __pseudo-Primary__ name (these are based on Local Authority name e.g. `Wakefield Direct to Supply Points`). The following method was used to update the Primaries GeoJSON:

1. The XLS was exported as CSV;
2. The CSV was added to QGIS (version 3.10.11) using `Layer > Add layer > Add Delimited Text Layer` with the CRS set to `EPSG:27700 - OSGB 1936`;
3. The `Rectangles, ovals, diamonds (fixed)` tool was then used to add 50x50m rectangles around each point;
4. Because some supply points are very close to each other, we need to then use the `Dissolve` tool to combine features based on the `PseudoPrimary` field;
5. We want to add the Blyth offshore windfarm. We put the polygon for it in a separate file making sure to give it the property `PseudoPrimary: Northumberland Direct to Supply Points`;
6. We add the Blyth polygon as a layer to QGIS and then use the `Merge vector layers` tool to combine it with the pseudo-Primary layer. 
7. Use the `Collect geometries` tool on the combined layer - making sure to use the `PseudoPrimary` field as the `Unique ID fields` - to create multi-part geometries for each pseudo-Primary;
8. Save this combined layer out as GeoJSON making sure to only keep the `PseudoPrimary` property and double-checking that the CRS is set to EPSG:4326/WGS84;
9. Manually edit the file and rename all the `PseudoPrimary` keys as `Primary`;
10. Load the result back into QGIS;
11. The difference of the existing Primaries and the pseudo-Primary layer was found using the `Difference` tool in QGIS. This gives us holes where the pseudo-Primaries are;
12. Use the `Merge vector layers` tool to combine the new difference layer with the pseudo-Primary layer;
13. Export the result with only the `Primary` key and with coordinate precision set to 4 decimal places;
14. Use a [GeoJSON minifier](https://open-innovations.github.io/geojson-minify/) to shrink the file size.

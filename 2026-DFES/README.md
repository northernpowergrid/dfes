# Northern Powergrid Future Energy Scenarios 2025

## About this visualisation

### Future Energy Scenarios 2025
Four of the scenarios presented are aligned with Nationalgrid|ESO's [Future Energy Scenarios](https://www.nationalgrideso.com/future-energy/future-energy-scenarios):

* Counterfactual
* Hydrogen Evolution
* Electric Engagement
* Holistic Transition
* NPg Reference Scenario

### Geographies

We [have created](https://odileeds.org/blog/2019-11-27-building-electricity-distribution-geography) [geographies (polygons) for each Primary substation](https://odileeds.github.io/northern-powergrid/2020-emerging-thinking/data/maps/primaries-unique.geojson) in Northern Powergrid's network. These were built up using [Output Areas](https://www.ons.gov.uk/methodology/geography/ukgeographies/censusgeographies/census2021geographies#output-areas-oas-) as these are the building blocks of census geography as used by the [Office of National Statistics](https://www.ons.gov.uk/). We have used customer postcodes to identify each Output Area supplied by each Primary substation. Output Areas with fewer than 10 customers connected to a Primary substation were excluded. This helped with anonymisation and also reduced data issues in the customer database e.g. incorrect customer postcodes. We construct representative geographies for each Primary substation from the remaining Output Areas. In cases where multiple Primary substations serve the same Output Area, that Output Area is assigned to the Primary substation that serves the most customers there. In 2023 we recreated the geographies using 2021 census Output Areas.

Some Primary substation geographies may show larger areas on the map than they cover in practice particularly in rural areas where network connectivity may be concentrated in specific parts of an Output Area. The areas shown here are representative for the purpose of showing the Future Energy Scenario model data and should not be relied upon for checking connectivity or to assess the terms of connection for specific premises.

### Local Authority view

The model predictions have been created by Primary substation and that is the definitive view. The Local Authority view is constructed from the Primary substation values. We have found the proportion of a Primary substation's customers in each Local Authority district (as defined in April 2019) by adding up the customers in each Output Area belonging to a specific Local Authority district. For some parameters (e.g. electric vehicles) the values from the Primary substations are apportioned to each Local Authority District and then summated into totals. For values which can't be summated (e.g. Peak demand) we have shown the maximum value for any Primary substation that serves a Local Authority. For Local Authorities which are only partially in Northern Powergrid areas the model only produces forecasts for the area served by Northern Powergrid, so it is not a total Local Authority forecast. Examples of these Local Authorities partially served by Northern Powergrid include Bassetlaw, East Lindsey, High Peak, North East Derbyshire, North East Lincolnshire, North Lincolnshire, Pendle, West Lindsey. There are some additional major sites situated within a Local Authority area which distribute into many Local Authority areas and which may have further direct connections for large wind, solar and other generation. Data for these Grid Supply Points (connection points between the GB transmission network and Northern Powergrid’s distribution network) and Bulk Supply Points (connection points on NPg's network which are fed from the Grid Supply Points and supply the primary substations) can also be downloaded from Data Mill North.
Data

The Primary substation [data files](data/) that power this visualisation are stored within this repository.

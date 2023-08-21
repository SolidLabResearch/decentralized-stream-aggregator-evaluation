#!/bin/bash

## The Aggregator Server Query Endpoint URL
ENDPOINT_URL="http://localhost:8080/"
FROM="2023-02-13T09:27:25.3280"
TO="2023-02-13T09:37:25.3280"

### Register a SELECT query on Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_SELECT_HR="http://localhost:8080/selectHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_SELECT_HR
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP,SELECT" >> register-queries-diff-complexity.csv

### Register a FILTER query on Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_FILTER_HR="http://localhost:8080/filterHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_FILTER_HR
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP,FILTER" >> register-queries-diff-complexity.csv

### Register a JOIN query on the Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_JOIN_HR="http://localhost:8080/joinHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_JOIN_HR
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP, JOIN" >> register-queries-diff-complexity.csv

### Register a AGGREGATE query on the Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_AGGREGATE_HR="http://localhost:8080/avgHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_AGGREGATE_HR
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP, AGGREGATE" >> register-queries-diff-complexity.csv

### Register a query with a SUBQUERY on the Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_WITH_SUBQUERY="http://localhost:8080/subqueryHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_WITH_SUBQUERY
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP, SUBQUERY" >> register-queries-diff-complexity.csv

### Register a Complex Pattern Matching Query on the Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_COMPLEX_PATTERN="http://localhost:8080/complexPatternHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_COMPLEX_PATTERN
TIMESTAMP=$(date +"%s")
echo "$TIMESTAMP, COMPLEX_PATTERN" >> register-queries-diff-complexity.csv
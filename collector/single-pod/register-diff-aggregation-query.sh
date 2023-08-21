#!/bin/bash

## The Aggregator Server Query Endpoint URL
ENDPOINT_URL="http://localhost:8080/"
FROM="2023-02-13T09:27:25.3280"
TO="2023-02-13T09:37:25.3280"

### Register a query with an Average Aggregate Function Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_AVG_HR="http://localhost:8080/avgHR6?from="+$FROM+"&to=+$TO+" 
curl -X GET $QUERY_AVG_HR
TIMESTAMP=$(date +"%s")
echo "Timestamp: $TIMESTAMP Query: $QUERY_AVG_HR" >> register-queries-diff-complexity.csv

### Register a query with a Max Aggregate Function Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_MAX_HR="http://localhost:8080/maxHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_MAX_HR
TIMESTAMP=$(date +"%s")
echo "Timestamp: $TIMESTAMP Query: $QUERY_MAX_HR" >> register-queries-diff-complexity.csv 

### Register a query with a Min Aggregate Function Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_MIN_HR="http://localhost:8080/minHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_MIN_HR
TIMESTAMP=$(date +"%s")
echo "Timestamp: $TIMESTAMP Query: $QUERY_MIN_HR" >> register-queries-diff-complexity.csv

### Register a query with a Count Aggregate Function Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_COUNT_HR="http://localhost:8080/countHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_COUNT_HR
TIMESTAMP=$(date +"%s")
echo "Timestamp: $TIMESTAMP Query: $QUERY_COUNT_HR" >> register-queries-diff-complexity.csv

### Register a query with a Sum Aggregate Function Heart Rate of Participant 6 between a 10 minute timeframe and a 10 second window
QUERY_SUM_HR="http://localhost:8080/sumHR6?from="+$FROM+"&to=+$TO+"
curl -X GET $QUERY_SUM_HR
TIMESTAMP=$(date +"%s")
echo "Timestamp: $TIMESTAMP Query: $QUERY_SUM_HR" >> register-queries-diff-complexity.csv


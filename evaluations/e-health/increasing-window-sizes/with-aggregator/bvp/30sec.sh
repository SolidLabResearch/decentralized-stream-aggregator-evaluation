#!/bin/bash
count = 0
while [ $count =lt 30]; do
	echo "executing iteration: $count"
	npx ts-node 30sec.ts
	((count++))
	sleep 5
	sleep 

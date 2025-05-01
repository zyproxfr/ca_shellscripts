#!/bin/bash
BIRTHDATE="1er janvier 2000"
Presents=10
BIRTHDAY=$(date -d "1 January 2000" +%A)

echo "Date d'anniversaire : $BIRTHDATE"
echo "Nombre de cadeaux : $Presents"
echo "Jour de la semaine : $BIRTHDAY"

if [ "$BIRTHDATE" = "1er janvier 2000" ]; then
    echo "BIRTHDATE is correct, it is $BIRTHDATE"
else
    echo "BIRTHDATE is incorrect - please retry"
fi
if [ $Presents = 10 ]; then
    echo "I have received $Presents presents"
else
    echo "Presents is incorrect - please retry"
fi
if [ "$BIRTHDAY" = "Saturday" ]; then
    echo "I was born on a $BIRTHDAY"
else
    echo "BIRTHDAY is incorrect - please retry"
fi
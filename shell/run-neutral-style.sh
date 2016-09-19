#! /bin/bash
. /root/.profile
NEU_TEMPLATE=$(aws s3api list-objects-v2 --bucket neutral-style | jq -r '.Contents[].Key')

echo "Find neautral template: "$NEU_TEMPLATE

for TEMP in $NEU_TEMPLATE
do
	aws s3api get-object --bucket neutral-style --key $TEMP /root/image/$TEMP
done

aws s3api get-object --bucket neutral-style-photos --key $1 /root/image/$1

cd /root/neural-style/
for TEMP in $NEU_TEMPLATE
do
	OUT=$(echo $1-$TEMP-output | sed -e "s/\.//g").png
	th neural_style.lua -style_image /root/image/$TEMP -content_image /root/image/$1 -output_image /root/image/$OUT
	aws s3api put-object --bucket neutral-style-output --key $OUT --body /root/image/$OUT --content-type "image/png"
done

for TEMP in $NEU_TEMPLATE
do
	rm -f /root/image/$TEMP
done

rm -f /root/image/*-output*.png

rm -f /root/image/$1

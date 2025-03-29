#!/bin/sh

npm install
npm run build
cd dist/public
AWS_PROFILE=benephactor aws s3 cp --recursive ./ s3://primeval-arcana-party-xp-calculator
AWS_PROFILE=benephactor aws cloudfront create-invalidation --distribution-id E2AMUOX7DSLEFY --paths "/*" --profile benephactor

cd ../../

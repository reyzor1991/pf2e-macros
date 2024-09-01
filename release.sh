readonly MODULE='pf2e-macros'

sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" module.json

rm -f ${MODULE}.zip
rm -R ${MODULE}


mkdir ${MODULE}
mkdir ${MODULE}/styles
cp -R packs ${MODULE}
cp -R scripts ${MODULE}
cp module.json ${MODULE}
cp main.css ${MODULE}/styles
cp README.md ${MODULE}
cp CHANGELOG.md ${MODULE}
cp -R templates ${MODULE}

zip -r ${MODULE}.zip ${MODULE}
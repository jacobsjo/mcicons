
rm -r icons/*
npm i
npm run createIcons
git add -f icons/
git commit -m "update icons"
git subtree split --branch icons --prefix icons/
git subtree push --prefix=icons/ origin icons
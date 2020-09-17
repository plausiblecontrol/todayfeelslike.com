#!/bin/python3
import bs4
from bs4 import BeautifulSoup as soup
import json
from urllib.request import urlopen
from collections import Counter
from datetime import date
from commonwords import *
from jsonfeeds import *
from rssfeeds import *


def readPage(url):
  Client = urlopen(url)
  page = Client.read()
  Client.close()
  return page

def fetch_rss():
  articles = list()
  for rssfeed in rss_news_urls:
    xml_page = readPage(rssfeed)
    newsitems = soup(xml_page,"xml").findAll("item")
    for article in newsitems:
      articles.append(article.title.text)
  return articles

def fetch_json():
  articles = list()
  for jsonfeed in json_news_urls:
    json_page = json.loads(readPage(jsonfeed).decode("utf-8"))
    for article in json_page['items']:
      articles.append(article['title'])
  return articles

def get_news():
  headlines = fetch_rss() + fetch_json()
  return headlines

newz = get_news()
print(len(newz))

words = str(' '.join(newz)).translate({ord(c): "" for c in "!@#$%^&*()[]{};:,./<>?\|`~-=_+\"'"}).lower().split()
print(len(words))

specialWords = list()
for s in words:
  if s not in common:
    specialWords.append(s)

print(Counter(specialWords).most_common(5))

#mostCommon = Counter(specialWords).most_common(1)[0][0]
#dayDiff=date.today()-date(2020,3,31)
#print(dayDiff.days)
#print(mostCommon)

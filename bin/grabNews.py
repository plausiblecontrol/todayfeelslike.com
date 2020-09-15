#!/bin/python3
import bs4
from bs4 import BeautifulSoup as soup
from urllib.request import urlopen
from collections import Counter
from datetime import date

news_url="https://news.google.com/news/rss"
Client=urlopen(news_url)
xml_page=Client.read()
Client.close()

commonWords = ['news','the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most','say','says']


soup_page=soup(xml_page,"xml")
news_list=soup_page.findAll("item")
# Print news title, url and publish date

articles = list()

for news in news_list:
  articles.append(news.title.text)

words = str(' '.join(articles)).translate({ord(c): "" for c in "!@#$%^&*()[]{};:,./<>?\|`~-=_+\"'"}).lower().split()

specialWords = list()
for s in words:
  if s not in commonWords:
    specialWords.append(s)

mostCommon = Counter(specialWords).most_common(1)[0][0]

dayDiff=date.today()-date(2020,3,31)
print(dayDiff.days)
print(mostCommon)

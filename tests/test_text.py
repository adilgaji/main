from factory.tts.text import count_words, make_chunks, normalize, split_paragraphs, split_sentences


def test_normalize_basic():
    t = normalize("He  said:  “Wait” ... and left.\r\n\r\n  Next   paragraph ’s here.")
    assert t == "He said: “Wait”… and left.\nNext paragraph 's here."


def test_normalize_dashes_and_ranges():
    assert normalize("pharaoh - Egypt's king") == "pharaoh — Egypt's king"
    assert normalize("pharaoh–Egypt's king") == "pharaoh — Egypt's king"
    assert normalize("pharaoh -- Egypt's king") == "pharaoh — Egypt's king"
    assert normalize("From 1914–1918 it raged.") == "From 1914 to 1918 it raged."
    assert normalize("480-479 BC") == "480 to 479 BC"
    # дефис внутри слова не трогаем
    assert normalize("a so-called mid-1300s war") == "a so-called mid-1300s war"


def test_normalize_brackets_reserved():
    assert "[" not in normalize("the king [sic] said")


def test_split_sentences_roundtrip():
    p = "In 480 BC, Greeks held the pass. About 1,000 years earlier, Dr. Smith says, she ruled. Three places. Why? Because."
    s = split_sentences(p)
    assert s == [
        "In 480 BC, Greeks held the pass.",
        "About 1,000 years earlier, Dr. Smith says, she ruled.",
        "Three places.",
        "Why?",
        "Because.",
    ]
    assert " ".join(s) == p


def test_split_sentences_quotes_and_initials():
    p = 'He wrote: "I came. I saw." Then J. Caesar left. It ended c. 44 BC.'
    s = split_sentences(p)
    assert s == ['He wrote: "I came.', 'I saw."', "Then J. Caesar left.", "It ended c. 44 BC."]
    assert " ".join(s) == p


def test_chunks_respect_paragraphs_and_size():
    text = "One two three. Four five six. Seven eight nine.\nSecond paragraph here. And more."
    chunks = make_chunks(text, max_chars=32)
    assert [c.paragraph for c in chunks] == [0, 0, 1]
    assert chunks[0].text == "One two three. Four five six."
    assert chunks[1].text == "Seven eight nine."
    assert chunks[1].first_sentence == 2
    assert chunks[2].first_sentence == 3
    # склейка кусков даёт исходные слова
    assert " ".join(c.text for c in chunks).split() == normalize(text).split()


def test_long_sentence_is_kept_whole():
    s = "word " * 100 + "end."
    chunks = make_chunks(s, max_chars=50)
    assert len(chunks) == 1


def test_count_words_ignores_lone_dash():
    assert count_words("pharaoh — Egypt's king.") == 3
    assert split_paragraphs("a\n\n\nb") == ["a", "b"]

"""
Trains a real ML classifier (RandomForest on color-histogram + HOG features)
for produce TYPE identification, replacing the old hand-tuned color/shape
heuristic in vision.py's classical CV fallback.

Data: Fruits-360 dataset (Horea94/Fruit-Images-Dataset on GitHub), sparse-
checked-out to only the classes rescue-os cares about.

Why RandomForest on hand-crafted features instead of a CNN: no GPU here,
and the goal is "jaldi" (fast) + must run offline inside a FastAPI backend
with just numpy/opencv/sklearn (no torch/tensorflow dependency to add).
This trains in seconds and gives a genuinely data-driven model instead of
manually guessed hue/aspect ranges.
"""

import os
import glob
import json
import numpy as np
import cv2
from skimage.feature import hog
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

DATA_ROOT = "/home/claude/fruits360"

# Map Fruits-360 folder names -> rescue-os's KNOWN_PRODUCE_TYPES labels
FOLDER_TO_LABEL = {
    "Apple Braeburn": "apple",
    "Apple Golden 1": "apple",
    "Apple Red 1": "apple",
    "Banana": "banana",
    "Mango": "mango",
    "Papaya": "papaya",
    "Cauliflower": "cauliflower",
    "Onion White": "onion",
    "Potato White": "potato",
    "Tomato 1": "tomato",
    "Grape White": "grapes",
}
# NOTE: "spinach" from KNOWN_PRODUCE_TYPES has no images in Fruits-360
# (it's a fruit/root-veg dataset, no leafy greens) - left out of this
# model, classical heuristic still handles it as an unknown-type guess.

IMG_SIZE = (100, 100)


def extract_features(img_bgr):
    img = cv2.resize(img_bgr, IMG_SIZE)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Color histogram (H + S channels, coarse bins) - captures the produce's
    # dominant color signature.
    hist_h = cv2.calcHist([hsv], [0], None, [30], [0, 180]).flatten()
    hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
    hist_h = hist_h / (hist_h.sum() + 1e-6)
    hist_s = hist_s / (hist_s.sum() + 1e-6)

    # HOG on grayscale - captures shape/edge/texture signature.
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hog_feat = hog(
        gray, orientations=9, pixels_per_cell=(16, 16),
        cells_per_block=(2, 2), feature_vector=True,
    )

    return np.concatenate([hist_h, hist_s, hog_feat])


def load_split(split_name):
    X, y = [], []
    for folder, label in FOLDER_TO_LABEL.items():
        pattern = os.path.join(DATA_ROOT, split_name, folder, "*.jpg")
        files = glob.glob(pattern)
        for f in files:
            img = cv2.imread(f)
            if img is None:
                continue
            X.append(extract_features(img))
            y.append(label)
    return np.array(X), np.array(y)


def main():
    print("Loading training images...")
    X_train, y_train = load_split("Training")
    print(f"  {len(X_train)} training images across {len(set(y_train))} classes")

    print("Loading test images...")
    X_test, y_test = load_split("Test")
    print(f"  {len(X_test)} test images")

    print("Training RandomForestClassifier...")
    clf = RandomForestClassifier(
        n_estimators=200, max_depth=None, n_jobs=-1, random_state=42,
    )
    clf.fit(X_train, y_train)

    print("\nEvaluating on held-out Fruits-360 test split:")
    preds = clf.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"Test accuracy: {acc:.4f}")
    print(classification_report(y_test, preds))

    out_dir = "/home/claude/rescue-os/backend/app/models"
    os.makedirs(out_dir, exist_ok=True)
    joblib.dump(clf, os.path.join(out_dir, "produce_type_classifier.joblib"))

    with open(os.path.join(out_dir, "model_metadata.json"), "w") as f:
        json.dump({
            "model": "RandomForestClassifier (sklearn)",
            "features": "HSV color histogram (H+S) + HOG on grayscale, 100x100 resized",
            "classes": sorted(set(y_train.tolist())),
            "train_images": len(X_train),
            "test_images": len(X_test),
            "test_accuracy": round(float(acc), 4),
            "trained_on": "Fruits-360 (Horea94/Fruit-Images-Dataset), subset of classes",
            "note": "produce TYPE classifier only - no freshness/quality-labeled "
                     "dataset was reachable in this environment, so quality "
                     "grading still uses the classical CV heuristic in vision.py",
        }, f, indent=2)

    print(f"\nSaved model to {out_dir}/produce_type_classifier.joblib")


if __name__ == "__main__":
    main()

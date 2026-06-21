from constants import ITEM_STATUS_DEFAULT, ITEM_STATUS_ACTIVE, ITEM_STATUS_HIGHLIGHTED

_CSS_CLASS_DEFAULT = "btn-default"
_CSS_CLASS_ACTIVE = "btn-warning"
_CSS_CLASS_HIGHLIGHTED = "btn-danger"


class CSSClassDecorator():

    @classmethod
    def decorate_items(cls, items_dict):
        data = []
        for item_name in sorted(items_dict.keys()):
            fragments = [item_name, items_dict[item_name]]
            fragments.append(cls._css_class_for_item(items_dict[item_name]))
            data.append(fragments)
        return data

    @staticmethod
    def _css_class_for_item(item_status):
        css_class = ""
        if item_status == ITEM_STATUS_DEFAULT:
            css_class = _CSS_CLASS_DEFAULT
        elif item_status == ITEM_STATUS_ACTIVE:
            css_class = _CSS_CLASS_ACTIVE
        elif item_status == ITEM_STATUS_HIGHLIGHTED:
            css_class = _CSS_CLASS_HIGHLIGHTED

        return css_class
